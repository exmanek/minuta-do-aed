"""Przepływ partii: wczytanie -> mapowanie -> przetwarzanie (walidacja, duplikaty) -> zatwierdzenie.
Zatwierdzenie w prototypie != eksport != publikacja w dane.gov.pl."""
import csv
import io
import json
from datetime import date

from flask import current_app

from ..domain.rules import issue
from ..domain.schema import field_names, load_schema
from ..errors import ApiError
from ..storage import repo
from ..storage.db import get_db
from . import dedupe, declarations, ingest, mapping, validation


def _schema():
    return load_schema(current_app.config["STANDARD_XLSX"])


def _zakres_json(v):
    if isinstance(v, dict):
        return json.dumps(v, ensure_ascii=False)
    return json.dumps({"opis": v}, ensure_ascii=False) if v else None


def _as_bool(v):
    return v is True or (isinstance(v, str) and v.strip().lower() in ("1", "true", "tak", "yes"))


# ---------------------------------------------------------------- wczytanie
def create_batch(provider, files, metas):
    """files: [(nazwa_pliku, bytes)], metas: lista słowników opisu źródeł (ta sama kolejność)."""
    schema = _schema()
    parsed = [ingest.parse_file(name, raw) for name, raw in files]  # 415/422 zanim cokolwiek zapiszemy
    names = [(m.get("nazwa") or files[i][0]).strip() for i, m in enumerate(metas)]
    if len(set(names)) != len(names):
        raise ApiError(400, "BAD_REQUEST", "Nazwy źródeł w jednej partii muszą być unikalne.")
    with get_db():
        batch_id = repo.create_batch(provider["regon"])
        for i, ((fname, _), p, m) in enumerate(zip(files, parsed, metas)):
            meta = dict(m)
            meta["zakres_json"] = _zakres_json(m.get("zakres_referencyjny"))
            meta["dane_przykladowe"] = _as_bool(m.get("dane_przykladowe"))
            sid = repo.upsert_source(provider["regon"], names[i], meta, p["format"], fname)
            repo.add_batch_source(batch_id, sid, fname, {k: p[k] for k in
                                  ("format", "kodowanie", "separator", "liczba_wierszy", "naglowki", "powtorzone")})
            for n, row in enumerate(p["wiersze"], 1):
                srid = str(row.get("aed_id") or row.get("id") or f"wiersz-{n}")
                repo.add_staged(batch_id, sid, srid, {"raw": row, "ref": f"{sid}#{n}"})
    return batch_id


def batch_view(batch):
    schema = _schema()
    zrodla = []
    for bs in repo.list_batch_sources(batch["id"]):
        info, src = bs["info"], repo.get_source(bs["source_id"])
        profile = repo.get_mapping(bs["source_id"])
        proposal = mapping.propose_mapping(info["naglowki"], schema, profile)
        zrodla.append({
            "zrodlo_id": bs["source_id"], "nazwa": src["nazwa"], "nazwa_pliku": bs["nazwa_pliku"], "format": info["format"],
            "kodowanie": info["kodowanie"], "separator": info["separator"], "liczba_wierszy": info["liczba_wierszy"],
            "dane_przykladowe": src["dane_przykladowe"], "licencja": src["licencja"],
            "prawo_do_udostepniania": src["prawo_do_udostepniania"], "dysponent_nazwa": src["dysponent_nazwa"],
            "zakres_referencyjny": src["zakres"],
            "kontrola_naglowkow": mapping.header_check(info["naglowki"], info["powtorzone"], proposal, schema),
            "proponowane_mapowanie": proposal,
            "zatwierdzone_mapowanie": profile if batch["status"] != "wczytana" else None})
    view = {"batch_id": batch["id"], "status": batch["status"], "eksport_wygenerowano": batch["eksport_wygenerowano"],
            "zrodla": zrodla}
    if batch["status"] in ("przetworzona", "zatwierdzona"):
        view["podsumowanie"] = summarize(batch["id"])
    return view


# ---------------------------------------------------------------- mapowanie
def approve_mapping(batch, mapowanie):
    if batch["status"] == "zatwierdzona":
        raise ApiError(409, "STATE_CONFLICT", "Partia jest już zatwierdzona.")
    schema = _schema()
    sources = {bs["source_id"]: bs for bs in repo.list_batch_sources(batch["id"])}
    if not isinstance(mapowanie, dict):
        raise ApiError(400, "BAD_REQUEST", "Pole 'mapowanie' musi być obiektem {zrodlo_id: {kolumna: pole|null}}.")
    problems = [{"zrodlo_id": s, "komunikat": "Nieznane źródło w tej partii."} for s in mapowanie if s not in sources]
    problems += [{"zrodlo_id": s, "komunikat": "Brak mapowania dla źródła."} for s in sources if s not in mapowanie]
    for sid, m in mapowanie.items():
        if sid in sources and isinstance(m, dict):
            problems += [{"zrodlo_id": sid, **p} for p in mapping.validate_mapping(m, schema, sources[sid]["info"]["naglowki"])]
        elif sid in sources:
            problems.append({"zrodlo_id": sid, "komunikat": "Mapowanie musi być obiektem {kolumna: pole|null}."})
    if problems:
        raise ApiError(422, "INVALID_MAPPING", "Niepoprawne mapowanie kolumn.", problems)
    with get_db():
        for sid, m in mapowanie.items():
            repo.save_mapping(sid, m)
        repo.replace_candidates(batch["id"], [])
        repo.set_batch_status(batch["id"], "zmapowana")


# ---------------------------------------------------------------- przetwarzanie
def _ref_issues(issues, srid):
    return [{**i, "aed_id": srid} for i in issues]


def process_batch(batch, provider):
    if batch["status"] not in ("zmapowana", "przetworzona"):
        raise ApiError(409, "STATE_CONFLICT", "Najpierw zatwierdź mapowanie kolumn (PUT .../mapping).")
    schema, cfg = _schema(), current_app.config
    sources = {bs["source_id"]: repo.get_source(bs["source_id"]) for bs in repo.list_batch_sources(batch["id"])}
    src_issues = {sid: validation.validate_source(s, schema) for sid, s in sources.items()}
    profiles = {sid: repo.get_mapping(sid) for sid in sources}
    items = []
    with get_db():
        for st in repo.list_staged(batch["id"]):
            sid, srid, pl = st["source_id"], st["source_record_id"], st["payload"]
            rec = mapping.build_record(pl["raw"], profiles[sid], schema)
            rec = mapping.fill_system_fields(rec, sources[sid], provider)
            issues = validation.validate_record(rec, schema, srid, cfg["PROG_AKTUALNOSCI_DNI"]) + _ref_issues(src_issues[sid], srid)
            existing = repo.find_aed_by_source(sid, srid)
            pl.update({"rekord": rec, "istniejacy_aed_id": existing})
            repo.update_staged(st["rid"], pl, issues)
            if isinstance(rec.get("lat"), (int, float)) and isinstance(rec.get("lon"), (int, float)):
                items.append({"ref": pl["ref"], "lat": rec["lat"], "lon": rec["lon"], "adres": rec.get("adres"),
                              "istniejacy": existing})
        repo.replace_candidates(batch["id"], dedupe.find_candidates(items, repo.nearby_aed))
        repo.set_batch_status(batch["id"], "przetworzona")
    summary = summarize(batch["id"])
    ok = summary["z_bledami"] == 0
    return {"status": "przetworzona", "podsumowanie": summary, "mozna_zatwierdzic": ok,
            "powod": None if ok else f"{summary['z_bledami']} rekordów z błędami blokującymi; użyj odrzuc_bledne lub popraw dane"}


def entries(batch_id):
    """Rekordy robocze z pełną listą problemów (zapisane + AED-DUP-001 dla nierozstrzygniętych par)."""
    staged = repo.list_staged(batch_id)
    by_ref = {s["payload"]["ref"]: s for s in staged}
    dups = {}
    for c in repo.list_candidates(batch_id):
        if c["decyzja"] == "brak":
            for ref in (c["aed_a"], c["aed_b"]):
                if ref in by_ref:
                    dups.setdefault(ref, []).append(c)
    out = []
    for s in staged:
        ref = s["payload"]["ref"]
        extra = [issue("AED-DUP-001", None, s["source_record_id"],
                       f"Nierozstrzygnięty kandydat na duplikat ({c['pewnosc']}, {c['odleglosc_m']} m).")
                 for c in dups.get(ref, [])]
        out.append({"rid": s["rid"], "ref": ref, "srid": s["source_record_id"], "source_id": s["source_id"],
                    "rekord": s["payload"].get("rekord"), "istniejacy": s["payload"].get("istniejacy_aed_id"),
                    "issues": s["issues"] + extra})
    return out


def summarize(batch_id):
    es, cands = entries(batch_id), repo.list_candidates(batch_id)
    blocked = [e for e in es if validation.has_blocking(e["issues"])]
    return {"rekordy": len(es), "bez_bledow": len(es) - len(blocked),
            "z_ostrzezeniami": sum(1 for e in es if any(i["poziom"] == "ostrzezenie" for i in e["issues"])),
            "z_bledami": len(blocked),
            "kandydaci_duplikatow": {"w_partii": sum(c["typ"] == "w_partii" for c in cands),
                                     "wzgledem_bazy": sum(c["typ"] == "wzgledem_bazy" for c in cands)},
            "zaktualizowane_istniejace": sum(1 for e in es if e["istniejacy"]),
            "niepotwierdzone_lub_do_odswiezenia": sum(1 for e in es if any(i["regula"] == "AED-FRESH-001" for i in e["issues"]))}


def report(batch, poziom=None, fmt="json"):
    if batch["status"] not in ("przetworzona", "zatwierdzona"):
        raise ApiError(409, "STATE_CONFLICT", "Partia nie została jeszcze przetworzona.")
    problems = [{**i, "zrodlo_id": e["source_id"]} for e in entries(batch["id"]) for i in e["issues"]
                if not poziom or i["poziom"] == poziom]
    if fmt == "csv":
        buf = io.StringIO()
        w = csv.DictWriter(buf, fieldnames=["aed_id", "zrodlo_id", "pole", "regula", "poziom", "komunikat"], delimiter=";")
        w.writeheader()
        w.writerows({k: p.get(k) for k in w.fieldnames} for p in problems)
        return "﻿" + buf.getvalue()
    return {"batch_id": batch["id"], "podsumowanie": summarize(batch["id"]), "problemy": problems}


# ---------------------------------------------------------------- duplikaty
def _card(rec):
    return {k: rec.get(k) for k in ("adres", "miasto", "lokalizacja_w_obiekcie", "lat", "lon", "zrodlo_danych",
                                    "data_ostatniego_potwierdzenia")} if rec else None


def duplicates_view(batch, provider):
    if batch["status"] not in ("przetworzona", "zatwierdzona"):
        raise ApiError(409, "STATE_CONFLICT", "Partia nie została jeszcze przetworzona.")
    by_ref = {e["ref"]: e for e in entries(batch["id"])}
    out = []
    for c in repo.list_candidates(batch["id"]):
        a = by_ref.get(c["aed_a"])
        if c["typ"] == "w_partii":
            b, owner = by_ref.get(c["aed_b"]), provider["regon"]
            card_b = _card(b["rekord"]) if b else None
        else:
            rec = repo.get_aed_row(c["aed_b"])
            owner, card_b = (rec or {}).get("regon_dostawcy"), _card(rec)
        out.append({**c, "karta_a": _card(a["rekord"]) if a else None, "karta_b": card_b,
                    "wlasciciel_b": owner, "wlasny_rekord_b": owner == provider["regon"]})
    return out


def _union_find():
    parent = {}

    def find(x):
        parent.setdefault(x, x)
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra == rb:
            return False
        parent[rb] = ra
        return True
    return find, union


def build_groups(es, cands):
    """Grupy do scalenia. Węzły: ref rekordu roboczego oraz 'aed:ID' rekordu z bazy.
    Łączy: ten sam rekord źródła (istniejacy) i decyzje 'scal'."""
    find, union = _union_find()
    refs = {e["ref"]: e for e in es}
    update_links, merges = set(), 0
    for e in es:
        find(e["ref"])
        if e["istniejacy"]:
            union(e["ref"], "aed:" + e["istniejacy"])
            update_links.add("aed:" + e["istniejacy"])
    for c in cands:
        if c["decyzja"] != "scal" or c["aed_a"] not in refs:
            continue
        b = c["aed_b"] if c["typ"] == "w_partii" else "aed:" + c["aed_b"]
        if c["typ"] == "w_partii" and b not in refs:
            continue
        merges += union(c["aed_a"], b)
    groups = {}
    for node in list(refs) + [n for n in set(update_links) | {("aed:" + c["aed_b"]) for c in cands
                                                             if c["decyzja"] == "scal" and c["typ"] == "wzgledem_bazy"}]:
        groups.setdefault(find(node), {"refs": [], "bases": []})
        (groups[find(node)]["refs"] if node in refs else groups[find(node)]["bases"]).append(node)
    return [g for g in groups.values() if g["refs"]], update_links, merges


def apply_decisions(batch, provider, decisions):
    if batch["status"] != "przetworzona":
        raise ApiError(409, "STATE_CONFLICT", "Decyzje można zapisać tylko dla partii w stanie 'przetworzona'.")
    if not isinstance(decisions, list):
        raise ApiError(400, "BAD_REQUEST", "Pole 'decyzje' musi być listą.")
    cands = {(c["aed_a"], c["aed_b"]): c for c in repo.list_candidates(batch["id"])}
    for d in decisions:
        key = (d.get("aed_a"), d.get("aed_b"))
        if d.get("decyzja") not in ("scal", "zostaw_oba"):
            raise ApiError(400, "BAD_REQUEST", "decyzja: scal lub zostaw_oba.")
        if key not in cands:
            raise ApiError(404, "NOT_FOUND", f"Brak pary kandydatów {key[0]} / {key[1]}.")
        c = cands[key]
        if d["decyzja"] == "scal" and c["typ"] == "wzgledem_bazy":
            rec = repo.get_aed_row(c["aed_b"], include_withdrawn=True)
            if not rec or rec.get("regon_dostawcy") != provider["regon"]:
                raise ApiError(422, "MERGE_FOREIGN_RECORD", "Scalenie z rekordem innego dostawcy jest zablokowane.", [
                    {"aed_a": key[0], "aed_b": key[1]}])
        c["decyzja"] = d["decyzja"]
    groups, _, _ = build_groups(entries(batch["id"]), list(cands.values()))
    for g in groups:
        if len(g["bases"]) > 1:
            raise ApiError(422, "STATE_CONFLICT", "Scalenie objęłoby dwa różne rekordy już zatwierdzone w bazie.",
                           [{"rekordy_w_bazie": [b[4:] for b in g["bases"]]}])
    with get_db():
        for d in decisions:
            repo.set_decision(batch["id"], d["aed_a"], d["aed_b"], d["decyzja"])
    return len(decisions)


# ---------------------------------------------------------------- zatwierdzenie
def _diff(before, after, fields):
    return {f: {"przed": before.get(f), "po": after.get(f)} for f in fields if before.get(f) != after.get(f)}


def commit_batch(batch, provider, body):
    if batch["status"] != "przetworzona":
        raise ApiError(409, "STATE_CONFLICT", "Zatwierdzić można tylko partię w stanie 'przetworzona'.")
    schema, regon = _schema(), provider["regon"]
    if (not _as_bool(body.get("oswiadczenie_prawdziwosci")) or not _as_bool(body.get("oswiadczenie_prawa_do_udostepniania"))
            or body.get("wersja_tresci") != declarations.VERSION):
        raise ApiError(422, "DECLARATION_REQUIRED", "Wymagane oba oświadczenia (prawdziwość danych i prawo do udostępniania) "
                       f"w aktualnej wersji treści ({declarations.VERSION}).", [{"regula": "AED-PROV-002", "poziom": "blad"}])
    es = entries(batch["id"])
    blocked = [e for e in es if validation.has_blocking(e["issues"])]
    if blocked and not _as_bool(body.get("odrzuc_bledne")):
        raise ApiError(422, "VALIDATION_BLOCKING", "Partia zawiera błędy blokujące, zatwierdzenie niemożliwe.",
                       [i for e in blocked for i in e["issues"] if i["poziom"] == "blad"])
    blocked_refs = {e["ref"] for e in blocked}
    good = [e for e in es if e["ref"] not in blocked_refs]
    if not good:
        raise ApiError(422, "VALIDATION_BLOCKING", "Brak rekordów do zatwierdzenia.", [])
    potwierdzam = _as_bool(body.get("potwierdzam_aktualnosc"))
    today = date.today().isoformat()
    fields = [f for f in field_names(schema)]
    sources = {sid: repo.get_source(sid) for sid in {e["source_id"] for e in good}}
    by_ref = {e["ref"]: e for e in good}
    groups, update_links, merged = build_groups(good, repo.list_candidates(batch["id"]))
    for g in groups:
        if len(g["bases"]) > 1:
            raise ApiError(422, "STATE_CONFLICT", "Scalenie objęłoby dwa różne rekordy już zatwierdzone w bazie.")
    committed = 0
    with get_db():
        for g in groups:
            staged = [by_ref[r] for r in g["refs"]]
            base_id = g["bases"][0][4:] if g["bases"] else None
            base = repo.get_aed_row(base_id, include_withdrawn=True) if base_id else None
            cands = [("staged", s["rekord"], s) for s in staged]
            if base and g["bases"][0] not in update_links:  # rekord z bazy dołączony decyzją 'scal'
                cands.append(("base", base, None))
            best = max(cands, key=lambda c: ((c[1].get("data_ostatniego_potwierdzenia") or ""), c[0] == "staged"))
            primary = best[1]
            payload = {f: primary.get(f) for f in fields}
            payload["dane_przykladowe"] = any(c[1].get("dane_przykladowe") for c in cands)
            conflicts = {}
            if len(cands) > 1:
                for f in fields:
                    vals = {json.dumps(c[1].get(f), ensure_ascii=False, default=str): c for c in cands if c[1].get(f) not in (None, "")}
                    if len(vals) > 1 and f not in ("aed_id", "data_ostatniej_edycji", "data_importu"):
                        conflicts[f] = [{"zrodlo": c[1].get("zrodlo_danych"), "wartosc": c[1].get(f)} for c in vals.values()]
            payload["konflikty"] = conflicts or None
            payload["nazwa_dostawcy"], payload["regon_dostawcy"] = provider["nazwa"], regon
            payload["oswiadczenie_prawdziwosci"] = True
            payload["data_ostatniej_edycji"], payload["data_importu"] = today, today
            if best[0] == "staged" and base:  # import nigdy nie obniża istniejącego potwierdzenia
                payload["data_ostatniego_potwierdzenia"] = max(payload.get("data_ostatniego_potwierdzenia") or "",
                                                               base.get("data_ostatniego_potwierdzenia") or "") or None
            if potwierdzam:
                payload["data_ostatniego_potwierdzenia"] = today  # tylko jawne działanie dostawcy
            aed_id = base_id or repo.next_aed_id()
            if base:
                repo.update_aed(aed_id, payload)
            else:
                payload["aed_id"] = aed_id
                repo.insert_aed(aed_id, payload, regon)
            payload["aed_id"] = aed_id
            for s in staged:
                src = sources[s["source_id"]]
                repo.upsert_aed_source(aed_id, s["source_id"], s["srid"], 0, today, src["zakres_json"], src["licencja"],
                                       src["dysponent_nazwa"])
            if best[0] == "staged":
                repo.set_main_source(aed_id, best[2]["source_id"], best[2]["srid"])
            before = base or {}
            info = {"batch_id": batch["id"], "zrodla": sorted({s["source_id"] for s in staged}),
                    "pola": _diff(before, payload, fields)}
            repo.append_history(aed_id, "import" if base else "utworzenie", regon, info)
            if len(cands) > 1 or len(g["bases"]) + len(staged) > 2:
                repo.append_history(aed_id, "scalenie", regon, {"batch_id": batch["id"], "scalone": g["refs"] + g["bases"],
                                                                  "konflikty": conflicts})
            if potwierdzam:
                repo.append_history(aed_id, "potwierdzenie", regon, {"batch_id": batch["id"], "data": today})
            committed += len(staged)
        zakres = {"zatwierdzone": committed, "odrzucone": len(blocked)}
        for typ in ("prawdziwosc", "prawo_do_udostepniania") + (("aktualnosc",) if potwierdzam else ()):
            repo.append_declaration(regon, typ, batch["id"], None, declarations.VERSION, declarations.content_hash(typ), zakres)
        repo.set_batch_status(batch["id"], "zatwierdzona")
    return {"status": "zatwierdzona", "zatwierdzone": committed, "odrzucone": len(blocked), "scalone": merged,
            "publikacja_dane_gov_pl": "nie_opublikowano_przez_prototyp",
            "eksport": {"csv": "/api/v1/export/aed.csv", "json": "/api/v1/export/aed.json",
                        "zrodla": "/api/v1/export/zrodla.csv", "aed_zrodla": "/api/v1/export/aed_zrodla.csv",
                        "metryka": "/api/v1/export/metadata.json"}}
