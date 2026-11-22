"""Odczyt punktu (lat, lon) z geometrii w różnych zapisach spotykanych w danych otwartych."""
import json
import re

_WKT = re.compile(r"^\s*POINT\s*Z?\s*\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)", re.I)


def _f(v):
    try:
        return float(str(v).strip().replace(",", "."))
    except (TypeError, ValueError):
        return None


def point_from(geom):
    """geom: dict | JSON-string | WKT | None -> (lat, lon) albo None.
    Obsługiwane: GeoJSON Point [lon, lat]; coordinates jako obiekt {lat, lon|lng|long}; {lat, lon} wprost; WKT POINT(lon lat)."""
    if geom is None or geom == "":
        return None
    if isinstance(geom, str):
        s = geom.strip()
        m = _WKT.match(s)
        if m:  # WKT: kolejność x y = lon lat
            lon, lat = _f(m.group(1)), _f(m.group(2))
            return (lat, lon) if lat is not None and lon is not None else None
        try:
            geom = json.loads(s)
        except ValueError:
            return None
    if not isinstance(geom, dict):
        return None
    c = geom.get("coordinates", geom)
    if isinstance(c, (list, tuple)) and len(c) >= 2:
        lon, lat = _f(c[0]), _f(c[1])
    elif isinstance(c, dict):
        lat = _f(c.get("lat", c.get("latitude")))
        lon = _f(next((c[k] for k in ("lon", "lng", "long", "longitude") if k in c), None))
    else:
        return None
    return (lat, lon) if lat is not None and lon is not None else None
