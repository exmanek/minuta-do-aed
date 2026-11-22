"""Eksport zatwierdzonych rekordów. CSV: kolumny dokładnie jak w XLSX. JSON/GeoJSON: kolumny XLSX + pola pochodne.
Pobranie plików NIE jest publikacją w dane.gov.pl."""
import csv
import io
import json
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime

from ..domain.schema import field_names
from ..storage import repo
from .freshness import znacznik_aktualnosci

DERIVED = ("znacznik_aktualnosci", "liczba_zrodel", "zrodla_skladowe", "dane_przykladowe")


def now_iso():
    return datetime.now().astimezone().isoformat(timespec="seconds")


def collect(schema, prog_dni, regon=None, only_ids=None):
    sources = {}
    for s in repo.list_aed_sources():
        sources.setdefault(s["aed_id"], []).append(s)
    out = []
    for r in repo.list_aed_rows(regon):
        if only_ids is not None and r["aed_id"] not in only_ids:
            continue
        rec = {f: r.get(f) for f in field_names(schema)}
        rec["znacznik_aktualnosci"] = znacznik_aktualnosci(r.get("data_ostatniego_potwierdzenia"), prog_dni)
        rec["zrodla_skladowe"] = sources.get(r["aed_id"], [])
        rec["liczba_zrodel"] = max(len(rec["zrodla_skladowe"]), 1)
        rec["dane_przykladowe"] = bool(r.get("dane_przykladowe"))
        out.append(rec)
    return out


def is_demo(records):
    return any(r["dane_przykladowe"] for r in records)


def suffix(records):
    return "_przykladowe" if is_demo(records) else ""


def _csv(columns, rows, delimiter):
    buf = io.StringIO()
    w = csv.writer(buf, delimiter=delimiter)
    w.writerow(columns)
    for r in rows:
        w.writerow(["" if r.get(c) is None else ("tak" if r.get(c) is True else "nie" if r.get(c) is False else r.get(c))
                    for c in columns])
    return "﻿" + buf.getvalue()


def to_csv(schema, records, delimiter=";"):
    return _csv(field_names(schema), records, delimiter)


# Zakres kolumn wykazu (zasobu tabelarycznego do publikacji w dane.gov.pl): podzbiór wzorca w jednej, ustalonej kolejności
# plus znacznik aktualności liczony z daty potwierdzenia. Pola wewnętrzne i techniczne (źródła składowe itp.) nie wchodzą do tabeli.
WYKAZ_FIELDS = ("aed_id", "adres", "miasto", "lokalizacja_w_obiekcie", "dostepnosc", "godziny_dostepu", "bariera_dostepu",
                "ograniczenia_dostepu", "stan", "lat", "lon", "data_ostatniego_potwierdzenia", "znacznik_aktualnosci",
                "dysponent_nazwa", "zrodlo_danych")


def wykaz_columns(schema):
    """Kolumny wykazu z etykietami ze wzorca (XLSX). Pole spoza wzorca (poza znacznikiem aktualności) jest pomijane."""
    labels = {f["nazwa"]: f["etykieta"] for f in schema["pola"]}
    labels["znacznik_aktualnosci"] = "Aktualność danych"
    return [{"nazwa": c, "etykieta": labels[c]} for c in WYKAZ_FIELDS if c in labels]


def to_wykaz_csv(schema, records, delimiter=";"):
    return _csv([c["nazwa"] for c in wykaz_columns(schema)], records, delimiter)


def to_wykaz_json(schema, records):
    cols = wykaz_columns(schema)
    return {"kolumny": cols, "items": [{c["nazwa"]: r.get(c["nazwa"]) for c in cols} for r in records],
            "liczba": len(records), "dane_przykladowe": is_demo(records), "data_wygenerowania": now_iso(),
            "publikacja_dane_gov_pl": "nie_opublikowano_przez_prototyp"}


def to_json(schema, records):
    cols = field_names(schema) + list(DERIVED)
    return {"items": [{c: r.get(c) for c in cols} for r in records], "liczba": len(records), "wygenerowano": now_iso(),
            "data_wygenerowania": now_iso(), "publikacja_dane_gov_pl": "nie_opublikowano_przez_prototyp"}


def to_geojson(schema, records):
    cols = field_names(schema) + list(DERIVED)
    feats = [{"type": "Feature", "geometry": {"type": "Point", "coordinates": [r["lon"], r["lat"]]},
              "properties": {c: r.get(c) for c in cols}} for r in records
             if isinstance(r.get("lat"), (int, float)) and isinstance(r.get("lon"), (int, float))]
    return {"type": "FeatureCollection", "features": feats, "wygenerowano": now_iso()}


def _source_rows(records):
    ids = {s["zrodlo_id"] for r in records for s in r["zrodla_skladowe"]}
    rows = []
    for sid in sorted(ids):
        s = repo.get_source(sid)
        if s:
            z = s["zakres"]
            rows.append({"zrodlo_id": sid, "nazwa": s["nazwa"], "url": s["url"], "format": s["format"], "licencja": s["licencja"],
                         "prawo_do_udostepniania": s["prawo_do_udostepniania"], "podstawa_prawa_opis": s["podstawa_prawa_opis"],
                         "dysponent_nazwa": s["dysponent_nazwa"], "dysponent_regon": s["dysponent_regon"],
                         "zakres_referencyjny": json.dumps(z, ensure_ascii=False) if isinstance(z, dict) else z,
                         "dane_przykladowe": s["dane_przykladowe"], "regon_dostawcy": s["regon_dostawcy"]})
    return rows


SOURCE_COLS = ["zrodlo_id", "nazwa", "url", "format", "licencja", "prawo_do_udostepniania", "podstawa_prawa_opis",
               "dysponent_nazwa", "dysponent_regon", "zakres_referencyjny", "dane_przykladowe", "regon_dostawcy"]
LINK_COLS = ["aed_id", "zrodlo_id", "source_record_id", "glowne", "data_importu"]


def sources_csv(records, delimiter=";"):
    return _csv(SOURCE_COLS, _source_rows(records), delimiter)


def links_csv(records, delimiter=";"):
    rows = [{"aed_id": r["aed_id"], **s} for r in records for s in r["zrodla_skladowe"]]
    return _csv(LINK_COLS, rows, delimiter)


def metadata(records, cfg):
    """Metryczka zbioru (WERSJA ROBOCZA: licencja zbioru, region i kategoria czekają na decyzję D9)."""
    demo = is_demo(records)
    title = "Defibrylatory AED – zbiór zbiorczy (Minuta do AED)"
    last = max([r.get("data_ostatniej_edycji") or "" for r in records] or [""]) or None
    sfx = suffix(records)
    res = lambda t, d, f: {"title": t, "description": d, "dataDate": last, "format": f}
    return {"title": ("[PRZYKŁADOWE] " + title) if demo else title,
            "description": "Zbiór zatwierdzonych przez dostawców danych o defibrylatorach AED z rozproszonych źródeł; "
                           "zakres referencyjny każdego źródła w zrodla.csv.",
            "updateFrequency": cfg["METADATA_UPDATE_FREQUENCY"], "category": cfg["METADATA_CATEGORY"],
            "tags": ["AED", "defibrylator", "zdrowie", "ratownictwo"],
            "license": cfg["METADATA_LICENSE"], "regions": cfg["METADATA_REGIONS"], "lastUpdateDate": last,
            "uwaga": "Metryczka robocza: licencja zbioru, region i kategoria nie są ustalone (decyzja D9). "
                     "Pobranie plików nie jest publikacją w dane.gov.pl.",
            "resources": [res(f"aed{sfx}.csv", "Rekordy AED, kolumny wg wzorca XLSX", "csv"),
                          res(f"aed{sfx}.json", "Rekordy AED ze źródłami składowymi", "json"),
                          res(f"aed{sfx}.geojson", "Rekordy AED jako punkty", "geojson"),
                          res("zrodla.csv", "Źródła, zakresy referencyjne, licencje", "csv"),
                          res("aed_zrodla.csv", "Powiązania rekordów ze źródłami", "csv")]}


def metadata_xml(meta):
    """Struktura robocza; NIE zwalidowana względem XSD harvestera 1.13 (pliku XSD nie ma w repozytorium)."""
    root = ET.Element("dataset")
    for k in ("title", "description", "updateFrequency", "category", "license", "lastUpdateDate"):
        ET.SubElement(root, k).text = "" if meta.get(k) is None else str(meta[k])
    tags = ET.SubElement(root, "tags")
    for t in meta["tags"]:
        ET.SubElement(tags, "tag").text = t
    regions = ET.SubElement(root, "regions")
    for r in meta["regions"]:
        ET.SubElement(regions, "region").text = str(r)
    resources = ET.SubElement(root, "resources")
    for r in meta["resources"]:
        el = ET.SubElement(resources, "resource")
        for k, v in r.items():
            ET.SubElement(el, k).text = "" if v is None else str(v)
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(root, encoding="unicode")


def build_zip(schema, records, cfg):
    sfx, d = suffix(records), cfg["CSV_DELIMITER"]
    meta = metadata(records, cfg)
    files = {f"aed{sfx}.csv": to_csv(schema, records, d),
             f"aed{sfx}.json": json.dumps(to_json(schema, records), ensure_ascii=False, indent=1),
             f"aed{sfx}.geojson": json.dumps(to_geojson(schema, records), ensure_ascii=False),
             "zrodla.csv": sources_csv(records, d), "aed_zrodla.csv": links_csv(records, d),
             "metadata.json": json.dumps(meta, ensure_ascii=False, indent=1), "metadata.xml": metadata_xml(meta)}
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for name, content in files.items():
            z.writestr(name, content)
    return buf.getvalue()
