"""Schemat pól wczytywany z XLSX (jedyne źródło prawdy).
Zakładki: 'Opis pól', 'Słowniki', 'Źródła', 'Pola wyliczane'."""
from openpyxl import load_workbook

_cache = {}


def _rows(wb, name):
    return list(wb[name].iter_rows(values_only=True))[1:] if name in wb.sheetnames else []


def _fields(rows):
    out = []
    for row in rows:
        if not row or not row[0]:
            continue
        nazwa, status, typ, etykieta, opis, przyklad = (list(row) + [None] * 6)[:6]
        out.append({"nazwa": nazwa, "status": status, "typ": typ, "etykieta": etykieta,
                    "opis": opis or "", "przyklad": przyklad or ""})
    return out


def load_schema(path):
    if path in _cache:
        return _cache[path]
    wb = load_workbook(path, read_only=True, data_only=True)
    slowniki = {}
    for row in _rows(wb, "Słowniki"):
        if row and row[0]:
            slowniki.setdefault(row[0], []).append(row[1])
    schema = {
        "wersja": "xlsx",
        "pola": _fields(_rows(wb, "Opis pól")),
        "zrodlo_pola": _fields(_rows(wb, "Źródła")),
        "pola_wyliczane": [{"nazwa": r[0], "opis": r[1] or ""} for r in _rows(wb, "Pola wyliczane") if r and r[0]],
        "slowniki": slowniki,
    }
    wb.close()
    _cache[path] = schema
    return schema


def field_names(schema):
    return [p["nazwa"] for p in schema["pola"]]
