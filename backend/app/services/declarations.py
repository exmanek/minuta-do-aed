"""Treść oświadczeń (ROBOCZA – wymaga zatwierdzenia prawnego przed użyciem produkcyjnym)."""
import hashlib

VERSION = "v1"
TEXTS = {
    "prawdziwosc": "Oświadczam, że dane przekazane w tej partii są zgodne ze stanem mi znanym i ręczę za ich prawdziwość.",
    "prawo_do_udostepniania": "Oświadczam, że mam prawo udostępniać te dane na wskazanych licencjach.",
    "aktualnosc": "Potwierdzam, że dane z tej partii są aktualne na dzień dzisiejszy.",
}
REQUIRED = ("prawdziwosc", "prawo_do_udostepniania")


def content_hash(typ):
    return hashlib.sha256(f"{VERSION}:{TEXTS[typ]}".encode()).hexdigest()


def as_payload():
    return {"wersja": VERSION, "robocza": True, "oswiadczenia": [
        {"typ": t, "wymagane": t in REQUIRED, "tresc": TEXTS[t], "tresc_hash": content_hash(t)} for t in TEXTS]}
