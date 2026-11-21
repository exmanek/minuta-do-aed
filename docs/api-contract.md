# Kontrakt API – Misja AED (v1)

Źródło: Dokumentacja techniczna v2 (pkt 3.4, 5) i decyzje techniczne. **Zmiany kontraktu tylko po uzgodnieniu frontend ↔ backend.**
Legenda statusu implementacji: ✅ działa, 🟡 szkielet (zwraca `501 NOT_IMPLEMENTED` w poprawnym formacie błędu).

## Zasady wspólne
- Prefiks `/api/v1`, JSON UTF-8, daty ISO 8601 (`RRRR-MM-DD` lub datetime z offsetem).
- Nazwy pól jak w XLSX (snake_case, bez polskich znaków). Lista pól: `GET /meta/schema` (nie duplikować ręcznie).
- Dostęp: **P** publiczny, **D** token dostawcy: `Authorization: Bearer <token>`.
- Frontend **nie liczy** `status_dostepnosci` ani `znacznik_aktualnosci` – robi to backend.
- Poprawny REGON ≠ potwierdzenie tożsamości. Zgłoszenia społeczności nigdy nie zmieniają rekordów AED.

### Format błędu (każdy błąd)
```json
{ "error": { "code": "ERROR_CODE", "message": "Opis błędu", "details": [] } }
```
`details` (opcjonalnie), np. dla walidacji: `{"aed_id":"AED-0007","pole":"lat","regula":"AED-COORD-001","poziom":"blad","komunikat":"Brak współrzędnych."}`.

| HTTP | Kody |
|---|---|
| 400 | BAD_REQUEST |
| 401 | AUTH_REQUIRED, INVALID_CREDENTIALS |
| 403 | FORBIDDEN, PROVIDER_NOT_VERIFIED |
| 404 | NOT_FOUND |
| 409 | STATE_CONFLICT |
| 413 | FILE_TOO_LARGE |
| 415 | UNSUPPORTED_FORMAT (tylko CSV/JSON/XLSX) |
| 422 | INVALID_REGON, DECLARATION_REQUIRED, VALIDATION_BLOCKING, HEADER_CHECK_FAILED, PARSE_ERROR, MERGE_FOREIGN_RECORD |
| 429 | RATE_LIMITED |
| 501 | NOT_IMPLEMENTED (tylko na czas budowy) |
| 500 | INTERNAL_ERROR |

Walidacja danych jako *wynik* (raport) zwraca 200; 422 tylko gdy operacja nie może się wykonać z powodu wyników (np. commit).

## Endpointy etapu 1

| Metoda i ścieżka | Dostęp | Status | Cel |
|---|---|---|---|
| GET /health | P | ✅ | sprawdzenie API |
| GET /meta/schema | P | ✅ | pola, statusy, typy, słowniki z XLSX |
| GET /aed | P | ✅ | lista zatwierdzonych AED |
| GET /aed/{id} | P | ✅ | szczegóły AED |
| POST /provider/login | P | 🟡 | logowanie (REGON sprawdzany składniowo już teraz) |
| POST /provider/batches | D | 🟡 | wczytanie plików (multipart) |
| GET /provider/batches/{id} | D | 🟡 | stan partii |
| POST /provider/batches/{id}/process | D | 🟡 | mapowanie wartości, walidacja |
| POST /provider/batches/{id}/commit | D | 🟡 | zatwierdzenie z oświadczeniami |
| GET /export/aed.csv | P | ✅ | CSV (UTF-8 z BOM, separator `;`, kolumny w kolejności z XLSX) |
| GET /export/aed.json | P | ✅ | JSON |

Dalsze endpointy (mapping, report, duplicates, export partii, /provider/aed/*, reports, geojson, metadata) – wg dokumentacji v2 pkt 5, dodawane iteracyjnie.

### GET /health → 200
```json
{ "status": "ok", "service": "misja-aed-api", "wersja_api": "v1" }
```

### GET /meta/schema → 200
```json
{ "wersja": "xlsx",
  "pola": [ { "nazwa": "lat", "status": "wymagane", "typ": "liczba", "etykieta": "Szerokość geograficzna", "opis": "WGS84" } ],
  "slowniki": { "dostepnosc": ["calodobowo", "w_godzinach", "nieznana"] } }
```
Statusy pól: `wymagane`, `warunkowo_wymagane`, `opcjonalne`, `wyliczane`.

### GET /aed → 200
Query: `lat`, `lon` (razem, inaczej 400), `radius_m` (domyślnie 2000, maks. 20000), `tylko_aktualne` (bool), `limit` (50, maks. 200), `offset`. Przy `lat`+`lon` wynik jest sortowany po odległości.
Planowane (backend): `bbox`, `status_dostepnosci`, `dostepnosc_teraz`, `sort`.
```json
{ "items": [ {
    "aed_id": "AED-DEMO-0001", "lat": 52.2286, "lon": 21.0035,
    "adres": "Al. Przykładowa 1", "miasto": "Warszawa",
    "dostepnosc": "calodobowo", "godziny_dostepu": null,
    "bariera_dostepu": "brak", "ograniczenia_dostepu": "publiczny", "stan": "sprawny",
    "status_dostepnosci": { "wartosc": "dostepny|ograniczony_dostep|niedostepny|nieznany",
                            "powod": "…", "brakujace": [], "na_chwile": "2026-11-21T21:10:00+01:00" },
    "nazwa_dostawcy": "Dostawca Demo 1", "regon_dostawcy": "123456785",
    "dysponent_nazwa": "Dysponent Demo A", "zrodlo_danych": "Zbiór demonstracyjny A",
    "zakres_referencyjny": "…",
    "data_ostatniego_potwierdzenia": "2026-11-15", "data_ostatniej_edycji": "2026-11-15",
    "znacznik_aktualnosci": "aktualne|do_odswiezenia|niepotwierdzone",
    "dane_przykladowe": true, "odleglosc_m": 605,
    "sygnaly": { "ostrzezenie_dostepu": false } } ],
  "liczba": 1, "limit": 50, "offset": 0, "wygenerowano": "2026-11-22T10:00:00+01:00" }
```
> ⚠️ Do czasu `services/availability.py` backend zwraca `status_dostepnosci.wartosc = "nieznany"` z powodem „obliczanie statusu jeszcze niezaimplementowane”. Frontend renderuje wartość z odpowiedzi; „nieznany” = brak danych, nie niedostępność.

### GET /aed/{id} → 200 (pojedynczy obiekt jak wyżej) / 404 NOT_FOUND
Docelowo dodatkowo `zrodla_skladowe`.

### POST /provider/login
Request: `{ "regon": "123456785", "haslo": "…" }`
Docelowa odpowiedź 200:
```json
{ "token": "<podpisany-token>", "wazny_do": "2026-11-22T05:12:00+01:00",
  "dostawca": { "regon": "123456785", "nazwa": "Dostawca Demo 1", "status_weryfikacji": "zweryfikowany" } }
```
Błędy: 400 brak pól; 422 `INVALID_REGON` (długość/suma kontrolna); 401 `INVALID_CREDENTIALS`; 403 `PROVIDER_NOT_VERIFIED`. **Obecnie:** po poprawnej składni zwraca 501.

### POST /provider/batches (multipart)
Pola: `files` (powtarzane, 1–10; .csv/.json/.xlsx), `meta` (JSON: tablica opisów źródeł w kolejności plików: `nazwa, url, licencja, prawo_do_udostepniania, podstawa_prawa_opis, dysponent_nazwa, dysponent_regon, zakres_referencyjny, dane_przykladowe`).
201:
```json
{ "batch_id": "b_01", "status": "wczytana",
  "zrodla": [ { "zrodlo_id": "s_01", "nazwa_pliku": "demo_a.csv", "format": "csv", "kodowanie": "utf-8",
    "separator": ";", "liczba_wierszy": 12, "dane_przykladowe": true,
    "kontrola_naglowkow": { "brakujace": ["dostepnosc"], "nadmiarowe": ["kolumna_x"], "powtorzone": [] },
    "proponowane_mapowanie": [ { "kolumna": "szer_geo", "pole": "lat", "pewnosc": "wysoka|niska|brak" } ] } ] }
```
Błędy: 413, 415, 422 `PARSE_ERROR`.

### GET /provider/batches/{id} → 200
`{ "batch_id", "status": "wczytana|zmapowana|przetworzona|zatwierdzona", "zrodla": [ … ] }`; 403/404.

### POST /provider/batches/{id}/process → 200
```json
{ "status": "przetworzona",
  "podsumowanie": { "rekordy": 42, "bez_bledow": 37, "z_ostrzezeniami": 9, "z_bledami": 5,
    "kandydaci_duplikatow": { "w_partii": 2, "wzgledem_bazy": 3 }, "zaktualizowane_istniejace": 4,
    "niepotwierdzone_lub_do_odswiezenia": 6 },
  "mozna_zatwierdzic": false, "powod": "5 rekordów z błędami blokującymi; …" }
```
Poziomy problemów: `blad` (blokuje) / `ostrzezenie`. Kody reguł: dokumentacja v2 pkt 4.3. 409 gdy brak zatwierdzonego mapowania.

### POST /provider/batches/{id}/commit
Request:
```json
{ "oswiadczenie_prawdziwosci": true, "oswiadczenie_prawa_do_udostepniania": true,
  "potwierdzam_aktualnosc": false, "wersja_tresci": "v1", "odrzuc_bledne": true }
```
200: `{ "status": "zatwierdzona", "zatwierdzone": 37, "odrzucone": 5, "scalone": 2, "publikacja_dane_gov_pl": "nie_opublikowano_przez_prototyp", "eksport": { "csv": "/api/v1/export/aed.csv", "json": "/api/v1/export/aed.json" } }`
Błędy: 409, 422 `DECLARATION_REQUIRED`, 422 `VALIDATION_BLOCKING` (lista w `details`).
Zatwierdzenie ≠ eksport ≠ publikacja w dane.gov.pl. Data potwierdzenia zmienia się tylko przy `potwierdzam_aktualnosc: true`.

### GET /export/aed.csv, GET /export/aed.json → 200
Tylko rekordy zatwierdzone. `Content-Disposition: attachment`. JSON: `{ "items": [...], "liczba", "wygenerowano", "publikacja_dane_gov_pl" }` – klucze jak w XLSX. Pobranie nie jest publikacją w dane.gov.pl.

## Mocki dla frontendu
Odpowiedzi powyżej są wzorcem do mocków. Dane demo na backendzie: `python scripts/seed_demo.py` (2 fikcyjne rekordy).
