"""Schemat pól wczytywany z XLSX (jedyne źródło prawdy). Zakładki: 'Opis pól' i 'Słowniki'."""
from openpyxl import load_workbook

_cache = {}


def load_schema(path):
    if path in _cache:
        return _cache[path]
    wb = load_workbook(path, read_only=True, data_only=True)
    pola = []
    for row in list(wb["Opis pól"].iter_rows(values_only=True))[1:]:
        if not row or not row[0]:
            continue
        nazwa, status, typ, etykieta, opis = (list(row) + [None] * 5)[:5]
        pola.append({"nazwa": nazwa, "status": status, "typ": typ, "etykieta": etykieta, "opis": opis or ""})
    slowniki = {}
    for row in list(wb["Słowniki"].iter_rows(values_only=True))[1:]:
        if row and row[0]:
            slowniki.setdefault(row[0], []).append(row[1])
    wb.close()
    _cache[path] = {"wersja": "xlsx", "pola": pola, "slowniki": slowniki}
    return _cache[path]


def field_names(schema):
    return [p["nazwa"] for p in schema["pola"]]
