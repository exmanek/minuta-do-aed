"""Eksport CSV/JSON zatwierdzonych rekordów; kolumny w kolejności ze schematu XLSX."""
import csv
import io
from datetime import datetime

from ..domain.schema import field_names


def export_rows(schema, records):
    cols = [c for c in field_names(schema)]
    return cols, [{c: r.get(c) for c in cols} for r in records]


def to_csv(schema, records, delimiter=";"):
    cols, rows = export_rows(schema, records)
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=cols, delimiter=delimiter)
    w.writeheader()
    for r in rows:
        w.writerow({k: ("" if v is None else v) for k, v in r.items()})
    return "﻿" + buf.getvalue()


def to_json(schema, records):
    _, rows = export_rows(schema, records)
    return {"items": rows, "liczba": len(rows), "wygenerowano": datetime.now().astimezone().isoformat(timespec="seconds"),
            "publikacja_dane_gov_pl": "nie_opublikowano_przez_prototyp"}
