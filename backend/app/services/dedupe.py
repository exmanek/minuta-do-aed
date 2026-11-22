"""Kandydaci na duplikaty: w partii i względem bazy. Żadnego automatycznego scalania."""
import difflib
from math import cos, radians

from .geo import haversine_m
from .mapping import normalize_name

DIST_M = 30
SIM_MIN = 0.8
_DLAT = DIST_M * 1.5 / 111_000


def addr_similarity(a, b):
    na, nb = (normalize_name(x or "").replace("_", " ") for x in (a, b))
    return round(difflib.SequenceMatcher(None, na, nb).ratio(), 3) if na and nb else 0.0


def _cand(a, b, typ, dist, sim):
    return {"aed_a": a, "aed_b": b, "typ": typ, "pewnosc": "prawdopodobny" if sim >= SIM_MIN else "mozliwy",
            "odleglosc_m": round(dist, 1), "podobienstwo_adresu": sim}


def find_candidates(items, nearby):
    """items: [{'ref','lat','lon','adres','istniejacy'}] (tylko z poprawnymi współrzędnymi).
    nearby(lat, lon, dlat, dlon) -> rekordy z bazy. Para ('ten sam rekord źródła') jest pomijana."""
    out = []
    for i, a in enumerate(items):
        for b in items[i + 1:]:
            d = haversine_m(a["lat"], a["lon"], b["lat"], b["lon"])
            if d <= DIST_M:
                out.append(_cand(a["ref"], b["ref"], "w_partii", d, addr_similarity(a.get("adres"), b.get("adres"))))
        dlon = _DLAT / max(cos(radians(a["lat"])), 0.01)
        for rec in nearby(a["lat"], a["lon"], _DLAT, dlon):
            if rec["aed_id"] == a.get("istniejacy"):
                continue
            d = haversine_m(a["lat"], a["lon"], rec["lat"], rec["lon"])
            if d <= DIST_M:
                out.append(_cand(a["ref"], rec["aed_id"], "wzgledem_bazy", d, addr_similarity(a.get("adres"), rec.get("adres"))))
    return out
