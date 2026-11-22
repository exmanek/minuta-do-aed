"""Funkcje zapisu/odczytu SQLite. Nie commitują: transakcją zarządza wywołujący (`with get_db():`).
Dla aed_history i declarations istnieją WYŁĄCZNIE funkcje dopisujące.
Zgłoszenia społeczności (field_reports) nie mają ścieżki zapisu do tabeli aed."""
import json
import uuid
from datetime import datetime, timedelta

from .db import get_db


def now_iso():
    return datetime.now().astimezone().isoformat(timespec="seconds")


def _one(sql, args=()):
    r = get_db().execute(sql, args).fetchone()
    return dict(r) if r else None


def _all(sql, args=()):
    return [dict(r) for r in get_db().execute(sql, args).fetchall()]


def _new_id(prefix):
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


# ---- dostawcy ----
def get_provider(regon):
    return _one("SELECT * FROM providers WHERE regon = ?", (regon,))


def create_provider(regon, nazwa, haslo_hash, status="zalozony"):
    zw = now_iso() if status == "zweryfikowany" else None
    get_db().execute("INSERT OR REPLACE INTO providers (regon,nazwa,haslo_hash,status_weryfikacji,zweryfikowano_kiedy)"
                     " VALUES (?,?,?,?,?)", (regon, nazwa, haslo_hash, status, zw))


# ---- źródła ----
def _source(row):
    if row:
        try:
            row["zakres"] = json.loads(row["zakres_json"]) if row.get("zakres_json") else None
        except ValueError:
            row["zakres"] = None
        row["dane_przykladowe"] = bool(row["dane_przykladowe"])
    return row


def get_source(source_id):
    return _source(_one("SELECT * FROM sources WHERE id = ?", (source_id,)))


def find_source(regon, nazwa):
    return _source(_one("SELECT * FROM sources WHERE regon_dostawcy = ? AND nazwa = ?", (regon, nazwa)))


def list_sources(regon):
    return [_source(r) for r in _all("SELECT * FROM sources WHERE regon_dostawcy = ? ORDER BY wczytano DESC", (regon,))]


def upsert_source(regon, nazwa, meta, fmt, filename):
    """Źródło jest identyfikowane parą (regon dostawcy, nazwa) – stabilne między partiami (klucz source_id + source_record_id)."""
    vals = (meta.get("url"), fmt, meta.get("licencja"), meta.get("prawo_do_udostepniania"),
            meta.get("podstawa_prawa_opis"), meta.get("dysponent_nazwa"), meta.get("dysponent_regon"),
            meta.get("zakres_json"), 1 if meta.get("dane_przykladowe") else 0, filename, now_iso())
    existing = find_source(regon, nazwa)
    if existing:
        get_db().execute("UPDATE sources SET url=?,format=?,licencja=?,prawo_do_udostepniania=?,podstawa_prawa_opis=?,"
                         "dysponent_nazwa=?,dysponent_regon=?,zakres_json=?,dane_przykladowe=?,nazwa_pliku=?,wczytano=?"
                         " WHERE id=?", vals + (existing["id"],))
        return existing["id"]
    sid = _new_id("s")
    get_db().execute("INSERT INTO sources (id,regon_dostawcy,nazwa,url,format,licencja,prawo_do_udostepniania,"
                     "podstawa_prawa_opis,dysponent_nazwa,dysponent_regon,zakres_json,dane_przykladowe,nazwa_pliku,wczytano)"
                     " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)", (sid, regon, nazwa) + vals)
    return sid


def get_mapping(source_id):
    r = _one("SELECT mapping_json FROM mapping_profiles WHERE source_id = ?", (source_id,))
    return json.loads(r["mapping_json"]) if r else None


def save_mapping(source_id, mapping):
    get_db().execute("INSERT OR REPLACE INTO mapping_profiles (source_id, mapping_json) VALUES (?,?)",
                     (source_id, json.dumps(mapping, ensure_ascii=False)))


# ---- partie ----
def create_batch(regon):
    bid = _new_id("b")
    get_db().execute("INSERT INTO batches (id, regon_dostawcy) VALUES (?,?)", (bid, regon))
    return bid


def get_batch(batch_id):
    return _one("SELECT * FROM batches WHERE id = ?", (batch_id,))


def set_batch_status(batch_id, status):
    get_db().execute("UPDATE batches SET status = ? WHERE id = ?", (status, batch_id))


def set_export_time(batch_id):
    get_db().execute("UPDATE batches SET eksport_wygenerowano = ? WHERE id = ?", (now_iso(), batch_id))


def add_batch_source(batch_id, source_id, filename, info):
    get_db().execute("INSERT INTO batch_sources (batch_id,source_id,nazwa_pliku,info_json) VALUES (?,?,?,?)",
                     (batch_id, source_id, filename, json.dumps(info, ensure_ascii=False)))


def list_batch_sources(batch_id):
    rows = _all("SELECT * FROM batch_sources WHERE batch_id = ? ORDER BY rowid", (batch_id,))
    for r in rows:
        r["info"] = json.loads(r.pop("info_json"))
    return rows


# ---- rekordy robocze ----
def add_staged(batch_id, source_id, srid, payload):
    get_db().execute("INSERT INTO staged_records (batch_id,source_id,source_record_id,payload_json) VALUES (?,?,?,?)",
                     (batch_id, source_id, srid, json.dumps(payload, ensure_ascii=False)))


def list_staged(batch_id):
    rows = _all("SELECT rowid AS rid, * FROM staged_records WHERE batch_id = ? ORDER BY rowid", (batch_id,))
    for r in rows:
        r["payload"] = json.loads(r.pop("payload_json"))
        r["issues"] = json.loads(r["issues_json"]) if r.get("issues_json") else []
    return rows


def update_staged(rid, payload, issues):
    get_db().execute("UPDATE staged_records SET payload_json=?, issues_json=? WHERE rowid=?",
                     (json.dumps(payload, ensure_ascii=False), json.dumps(issues, ensure_ascii=False), rid))


def replace_candidates(batch_id, cands):
    db = get_db()
    db.execute("DELETE FROM duplicate_candidates WHERE batch_id = ?", (batch_id,))
    for c in cands:
        db.execute("INSERT INTO duplicate_candidates (batch_id,aed_a,aed_b,typ,pewnosc,odleglosc_m,podobienstwo_adresu)"
                   " VALUES (?,?,?,?,?,?,?)", (batch_id, c["aed_a"], c["aed_b"], c["typ"], c["pewnosc"],
                                               c["odleglosc_m"], c["podobienstwo_adresu"]))


def list_candidates(batch_id):
    return _all("SELECT * FROM duplicate_candidates WHERE batch_id = ? ORDER BY rowid", (batch_id,))


def set_decision(batch_id, a, b, decyzja):
    return get_db().execute("UPDATE duplicate_candidates SET decyzja=? WHERE batch_id=? AND aed_a=? AND aed_b=?",
                            (decyzja, batch_id, a, b)).rowcount


# ---- oficjalne rekordy AED ----
def _record(r):
    rec = json.loads(r["payload_json"])
    rec["aed_id"] = r["aed_id"]
    rec["lat"], rec["lon"] = r["lat"], r["lon"]
    rec["data_ostatniego_potwierdzenia"] = r["data_ostatniego_potwierdzenia"]
    rec["data_ostatniej_edycji"] = r["data_ostatniej_edycji"]
    rec["regon_dostawcy"] = r["regon_dostawcy"] or rec.get("regon_dostawcy")
    rec["_status"] = r["status"]
    return rec


def list_aed_rows(regon=None, include_withdrawn=False):
    sql, args = "SELECT * FROM aed WHERE 1=1", []
    if not include_withdrawn:
        sql += " AND status = 'zatwierdzony'"
    if regon:
        sql += " AND regon_dostawcy = ?"
        args.append(regon)
    return [_record(r) for r in _all(sql + " ORDER BY aed_id", args)]


def get_aed_row(aed_id, include_withdrawn=False):
    r = _one("SELECT * FROM aed WHERE aed_id = ?", (aed_id,))
    if not r or (r["status"] != "zatwierdzony" and not include_withdrawn):
        return None
    return _record(r)


def nearby_aed(lat, lon, dlat, dlon):
    rows = _all("SELECT * FROM aed WHERE status='zatwierdzony' AND lat BETWEEN ? AND ? AND lon BETWEEN ? AND ?",
                (lat - dlat, lat + dlat, lon - dlon, lon + dlon))
    return [_record(r) for r in rows]


def next_aed_id():
    n = _one("SELECT COUNT(*) AS n FROM aed")["n"] + 1
    while _one("SELECT 1 AS x FROM aed WHERE aed_id = ?", (f"AED-{n:06d}",)):
        n += 1
    return f"AED-{n:06d}"


def _clean(payload):
    return {k: v for k, v in payload.items() if not k.startswith("_")}


def insert_aed(aed_id, payload, regon, status="zatwierdzony"):
    get_db().execute("INSERT INTO aed (aed_id,payload_json,lat,lon,regon_dostawcy,data_ostatniego_potwierdzenia,"
                     "data_ostatniej_edycji,status) VALUES (?,?,?,?,?,?,?,?)",
                     (aed_id, json.dumps(_clean(payload), ensure_ascii=False), payload.get("lat"), payload.get("lon"),
                      regon, payload.get("data_ostatniego_potwierdzenia"), payload.get("data_ostatniej_edycji"), status))


def update_aed(aed_id, payload, status="zatwierdzony"):
    get_db().execute("UPDATE aed SET payload_json=?,lat=?,lon=?,data_ostatniego_potwierdzenia=?,"
                     "data_ostatniej_edycji=?,status=? WHERE aed_id=?",
                     (json.dumps(_clean(payload), ensure_ascii=False), payload.get("lat"), payload.get("lon"),
                      payload.get("data_ostatniego_potwierdzenia"), payload.get("data_ostatniej_edycji"), status, aed_id))


def set_aed_status(aed_id, status):
    get_db().execute("UPDATE aed SET status = ? WHERE aed_id = ?", (status, aed_id))


# ---- powiązania ze źródłami ----
def find_aed_by_source(source_id, srid):
    r = _one("SELECT aed_id FROM aed_sources WHERE source_id = ? AND source_record_id = ?", (source_id, srid))
    return r["aed_id"] if r else None


def upsert_aed_source(aed_id, source_id, srid, glowne, data_importu, zakres, licencja, dysponent):
    db = get_db()
    ex = _one("SELECT rowid AS rid FROM aed_sources WHERE source_id = ? AND source_record_id = ?", (source_id, srid))
    vals = (aed_id, glowne, data_importu, zakres, licencja, dysponent)
    if ex:
        db.execute("UPDATE aed_sources SET aed_id=?,glowne=?,data_importu=?,zakres_snapshot_json=?,"
                   "licencja_snapshot=?,dysponent_snapshot=? WHERE rowid=?", vals + (ex["rid"],))
    else:
        db.execute("INSERT INTO aed_sources (aed_id,glowne,data_importu,zakres_snapshot_json,licencja_snapshot,"
                   "dysponent_snapshot,source_id,source_record_id) VALUES (?,?,?,?,?,?,?,?)", vals + (source_id, srid))


def set_main_source(aed_id, source_id, srid):
    db = get_db()
    db.execute("UPDATE aed_sources SET glowne = 0 WHERE aed_id = ?", (aed_id,))
    db.execute("UPDATE aed_sources SET glowne = 1 WHERE aed_id = ? AND source_id = ? AND source_record_id = ?",
               (aed_id, source_id, srid))


def list_aed_sources(aed_id=None):
    sql = ("SELECT a.aed_id, a.source_id AS zrodlo_id, a.source_record_id, a.glowne, a.data_importu, "
           "a.zakres_snapshot_json, a.licencja_snapshot, a.dysponent_snapshot, s.nazwa AS zrodlo_nazwa "
           "FROM aed_sources a LEFT JOIN sources s ON s.id = a.source_id")
    rows = _all(sql + (" WHERE a.aed_id = ?" if aed_id else "") + " ORDER BY a.aed_id, a.glowne DESC", (aed_id,) if aed_id else ())
    for r in rows:
        z = r.pop("zakres_snapshot_json")
        r["zakres_referencyjny"] = json.loads(z) if z else None
        r["licencja"] = r.pop("licencja_snapshot")
        r["dysponent_nazwa"] = r.pop("dysponent_snapshot")
        r["glowne"] = bool(r["glowne"])
    return rows


def aed_ids_for_sources(source_ids):
    if not source_ids:
        return []
    q = ",".join("?" * len(source_ids))
    return [r["aed_id"] for r in _all(f"SELECT DISTINCT aed_id FROM aed_sources WHERE source_id IN ({q})", list(source_ids))]


# ---- historia i deklaracje (tylko dopisywanie) ----
def append_history(aed_id, typ, autor, zmiany):
    get_db().execute("INSERT INTO aed_history (aed_id,kiedy,typ_zmiany,autor,zmiany_json) VALUES (?,?,?,?,?)",
                     (aed_id, now_iso(), typ, autor, json.dumps(zmiany, ensure_ascii=False)))


def list_history(aed_id, limit=100):
    rows = _all("SELECT * FROM aed_history WHERE aed_id = ? ORDER BY id DESC LIMIT ?", (aed_id, limit))
    for r in rows:
        r["zmiany"] = json.loads(r.pop("zmiany_json") or "null")
    return rows


def append_declaration(regon, typ, batch_id, aed_id, wersja, tresc_hash, zakres):
    get_db().execute("INSERT INTO declarations (regon,typ,batch_id,aed_id,wersja_tresci,tresc_hash,zakres_json,zaakceptowano)"
                     " VALUES (?,?,?,?,?,?,?,?)", (regon, typ, batch_id, aed_id, wersja, tresc_hash,
                                                   json.dumps(zakres, ensure_ascii=False), now_iso()))


def list_declarations(aed_id, batch_ids):
    q = ",".join("?" * len(batch_ids)) or "NULL"
    rows = _all(f"SELECT * FROM declarations WHERE aed_id = ? OR batch_id IN ({q}) ORDER BY id DESC", [aed_id] + list(batch_ids))
    for r in rows:
        r["zakres"] = json.loads(r.pop("zakres_json") or "null")
    return rows


# ---- zgłoszenia oddolne (osobno od aed) ----
def add_report(aed_id, typ, komentarz, ip_hash):
    cur = get_db().execute("INSERT INTO field_reports (aed_id,typ,komentarz,utworzono,ip_hash) VALUES (?,?,?,?,?)",
                           (aed_id, typ, komentarz, now_iso(), ip_hash))
    return cur.lastrowid


def get_report(rid):
    return _one("SELECT * FROM field_reports WHERE id = ?", (rid,))


def list_reports(aed_id, limit=50):
    return _all("SELECT id, aed_id, typ, komentarz, utworzono FROM field_reports WHERE aed_id = ? ORDER BY id DESC LIMIT ?",
                (aed_id, limit))


def report_counts(days=90):
    since = (datetime.now().astimezone() - timedelta(days=days)).isoformat(timespec="seconds")
    out = {}
    for r in _all("SELECT aed_id, typ, COUNT(*) AS n FROM field_reports WHERE utworzono >= ? GROUP BY aed_id, typ", (since,)):
        out.setdefault(r["aed_id"], {})[r["typ"]] = r["n"]
    return out
