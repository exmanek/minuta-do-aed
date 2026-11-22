"""Wczytanie CSV / JSON / XLSX do listy słowników. Wszystko inne (PDF, DOC, XLS...) -> 415."""
import csv
import io
import json
from datetime import date, datetime
from pathlib import Path

from openpyxl import load_workbook

from ..errors import ApiError

ALLOWED = {".csv": "csv", ".json": "json", ".xlsx": "xlsx"}
CSV_ENCODINGS = ("utf-8-sig", "cp1250", "iso-8859-2")
SEPARATORS = (";", ",", "\t")


def detect_format(filename):
    ext = Path(filename or "").suffix.lower()
    if ext not in ALLOWED:
        raise ApiError(415, "UNSUPPORTED_FORMAT",
                       f"Plik '{filename}' ({ext or 'bez rozszerzenia'}) nie jest dopuszczalnym formatem danych. "
                       "Dozwolone: CSV, JSON, XLSX (PDF i DOC nie są formatami danych).")
    return ALLOWED[ext]


def decode_csv(raw):
    for enc in CSV_ENCODINGS:
        try:
            return raw.decode(enc), ("utf-8" if enc == "utf-8-sig" else enc)
        except UnicodeDecodeError:
            continue
    raise ApiError(422, "PARSE_ERROR", "Nie rozpoznano kodowania pliku CSV.")


def detect_separator(text):
    line = next((l for l in text.splitlines() if l.strip()), "")
    counts = {s: line.count(s) for s in SEPARATORS}
    best = max(counts, key=counts.get)
    return best if counts[best] else ";"


def _cell(v):
    if isinstance(v, datetime):
        return v.date().isoformat()
    if isinstance(v, date):
        return v.isoformat()
    if isinstance(v, str):
        v = v.strip()
    return None if v == "" else v


def _rows_from_table(table):
    """table: lista list. Pierwszy niepusty wiersz = nagłówki."""
    table = [r for r in table if any(c not in (None, "") for c in r)]
    if not table:
        raise ApiError(422, "PARSE_ERROR", "Plik nie zawiera danych.")
    headers = [str(c).strip() if c is not None else "" for c in table[0]]
    seen, dup = set(), []
    for h in headers:
        if h in seen and h not in dup:
            dup.append(h)
        seen.add(h)
    rows = []
    for r in table[1:]:
        row = {}
        for i, h in enumerate(headers):
            if h and h not in row:  # przy powtórzonym nagłówku wygrywa pierwsza kolumna
                row[h] = _cell(r[i]) if i < len(r) else None
        rows.append(row)
    return [h for h in dict.fromkeys(headers) if h], dup, rows


def _parse_csv(raw):
    text, enc = decode_csv(raw)
    sep = detect_separator(text)
    headers, dup, rows = _rows_from_table(list(csv.reader(io.StringIO(text), delimiter=sep)))
    return {"kodowanie": enc, "separator": sep, "naglowki": headers, "powtorzone": dup, "wiersze": rows}


def _parse_json(raw):
    try:
        data = json.loads(raw.decode("utf-8-sig"))
    except (UnicodeDecodeError, ValueError):
        raise ApiError(422, "PARSE_ERROR", "Niepoprawny plik JSON (wymagany UTF-8).")
    if isinstance(data, dict):
        for key in ("features", "items", "dane", "data", "records"):
            if isinstance(data.get(key), list):
                data = data[key]
                break
        else:
            raise ApiError(422, "PARSE_ERROR", "JSON musi być listą obiektów (lub obiektem z listą 'items'/'features').")
    if not isinstance(data, list) or not all(isinstance(x, dict) for x in data):
        raise ApiError(422, "PARSE_ERROR", "JSON musi być listą obiektów.")
    rows = []
    for obj in data:
        if obj.get("type") == "Feature":  # GeoJSON
            coords = (obj.get("geometry") or {}).get("coordinates") or [None, None]
            obj = {**(obj.get("properties") or {}), "lon": coords[0], "lat": coords[1]}
        rows.append({str(k): (v if isinstance(v, (int, float)) or v is None else _cell(v if isinstance(v, str) else json.dumps(v, ensure_ascii=False)))
                     for k, v in obj.items()})
    headers = list(dict.fromkeys(k for r in rows for k in r))
    if not rows:
        raise ApiError(422, "PARSE_ERROR", "Plik nie zawiera danych.")
    return {"kodowanie": "utf-8", "separator": None, "naglowki": headers, "powtorzone": [], "wiersze": rows}


def _parse_xlsx(raw):
    try:
        wb = load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
        ws = wb["Dane"] if "Dane" in wb.sheetnames else wb[wb.sheetnames[0]]
        table = [list(r) for r in ws.iter_rows(values_only=True)]
        wb.close()
    except ApiError:
        raise
    except Exception:
        raise ApiError(422, "PARSE_ERROR", "Nie udało się odczytać pliku XLSX.")
    headers, dup, rows = _rows_from_table(table)
    return {"kodowanie": None, "separator": None, "naglowki": headers, "powtorzone": dup, "wiersze": rows}


def parse_file(filename, raw):
    fmt = detect_format(filename)
    try:
        parsed = {"csv": _parse_csv, "json": _parse_json, "xlsx": _parse_xlsx}[fmt](raw)
    except ApiError:
        raise
    except Exception:
        raise ApiError(422, "PARSE_ERROR", f"Nie udało się odczytać pliku '{filename}'.")
    parsed["format"] = fmt
    parsed["liczba_wierszy"] = len(parsed["wiersze"])
    return parsed
