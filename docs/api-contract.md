# Kontrakt API – Misja AED (v1)

Źródło: Dokumentacja techniczna v2 (pkt 3.4, 5) i decyzje techniczne. **Zmiany kontraktu tylko po uzgodnieniu frontend ↔ backend.**
Legenda statusu implementacji: ✅ działa, 🟡 szkielet/częściowo.

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
| 422 | INVALID_MAPPING (nieprawidłowe mapowanie kolumn) |
| 502 | UPSTREAM_ERROR (portal dane.gov.pl niedostępny lub zwrócił błąd) |
| 504 | UPSTREAM_TIMEOUT (portal dane.gov.pl nie odpowiedział w czasie) |
| 501 | NOT_IMPLEMENTED (zarezerwowany; obecnie nieużywany) |
| 500 | INTERNAL_ERROR |

Walidacja danych jako *wynik* (raport) zwraca 200; 422 tylko gdy operacja nie może się wykonać z powodu wyników (np. commit).

## Endpointy etapu 1

| Metoda i ścieżka | Dostęp | Status | Cel |
|---|---|---|---|
| GET /health | P | ✅ | sprawdzenie API |
| GET /meta/schema | P | ✅ | pola, statusy, typy, słowniki z XLSX |
| GET /aed | P | ✅ | lista zatwierdzonych AED |
| GET /aed/{id} | P | ✅ | szczegóły AED |
| POST /provider/login | P | ✅ | logowanie (REGON sprawdzany składniowo już teraz) |
| POST /provider/batches | D | ✅ | wczytanie plików (multipart) |
| GET /provider/batches/{id} | D | ✅ | stan partii |
| POST /provider/batches/{id}/process | D | ✅ | mapowanie wartości, walidacja |
| POST /provider/batches/{id}/commit | D | ✅ | zatwierdzenie z oświadczeniami |
| GET /export/aed.csv | P | ✅ | CSV (UTF-8 z BOM, separator `;`, kolumny w kolejności z XLSX) |
| GET /export/aed.json | P | ✅ | JSON |

### Pozostałe endpointy (wszystkie ✅)
| Metoda i ścieżka | Dostęp | Uwagi |
|---|---|---|
| GET /meta/oswiadczenie | P | 3 oświadczenia, `wersja` (obecnie `v1`), `robocza: true` |
| GET /standard/template.xlsx | P | pobranie wzorca XLSX |
| GET /provider/me, GET /provider/sources | D | profil i źródła dostawcy |
| PUT /provider/batches/{id}/mapping | D | body `{"mapowanie": {zrodlo_id: {kolumna: pole\|null}}}` → `{status: "zmapowana"}`; 422 `INVALID_MAPPING` |
| GET /provider/batches/{id}/report | D | query `poziom` (blad\|ostrzezenie), `format` (json\|csv); 409 gdy partia nieprzetworzona |
| GET /provider/batches/{id}/duplicates | D | `items[]`: `aed_a`, `aed_b`, `typ` (w_partii\|wzgledem_bazy), `pewnosc`, `odleglosc_m`, `podobienstwo_adresu`, `decyzja`, `karta_a`, `karta_b`, `wlasciciel_b`, `wlasny_rekord_b` |
| POST /provider/batches/{id}/duplicates/decisions | D | `{"decyzje":[{"aed_a","aed_b","decyzja":"scal\|zostaw_oba"}]}`; 422 `MERGE_FOREIGN_RECORD`; domyślnie nic nie jest scalane |
| GET /provider/batches/{id}/export | D | query `format` (csv\|json\|geojson\|zip); po `commit`, ustawia `eksport_wygenerowano` |
| GET /provider/aed | D | własne punkty (w tym wycofane, pole `status`) |
| POST /provider/aed/validate | D | `{problemy:[...], mozna_zapisac}` – bez zapisu |
| POST /provider/aed, PUT/DELETE /provider/aed/{id} | D | body: pola rekordu + `oswiadczenie_prawdziwosci`, `oswiadczenie_prawa_do_udostepniania`, `wersja_tresci`, `potwierdzam_aktualnosc`; DELETE = status `wycofany` |
| GET /provider/aed/{id}/history | D | `{historia:[...], deklaracje:[...]}` (tylko odczyt) |
| GET /aed/{id}/reports, POST /aed/{id}/reports | P | zgłoszenia z terenu; typy: zamkniete_na_klucz, potwierdzam_obecnosc, brak_urzadzenia, uszkodzone; komentarz ≤300; 5/h na IP (429) |
| GET /export/aed.geojson, zrodla.csv, aed_zrodla.csv, metadata.json, metadata.xml | P | `metadata.*` to wersja robocza (licencja zbioru, region, kategoria: decyzja D9); XML nie jest zwalidowany względem XSD 1.13 (brak pliku XSD w repo) |

### Reguły, o których frontend musi wiedzieć
- `GET /aed` zwraca tylko rekordy zatwierdzone. Filtry: `lat`+`lon`, `radius_m`, `bbox`, `status_dostepnosci` (lista po przecinku), `dostepnosc_teraz` (pomija tylko `niedostepny`), `tylko_aktualne`, `sort=odleglosc`, `limit`, `offset`. Błędne parametry: 400.
- `status_dostepnosci` liczy backend z czterech aspektów (godziny, bariera, ograniczenia, stan) w strefie Europe/Warsaw; brak informacji = `nieznany`. W `GET /aed/{id}` jest też `zrodla_skladowe`; `sygnaly` pochodzą ze zgłoszeń i nie wpływają na status.
- Nazwa źródła (`meta[].nazwa`, domyślnie nazwa pliku) jest stabilna między partiami: ponowny import tego samego źródła aktualizuje rekordy po (źródło, `aed_id`/numer wiersza) i **nie obniża** istniejącej daty potwierdzenia.
- Eksport CSV: kolumny = pola z XLSX, wartości `tak_nie` jako `tak`/`nie`. JSON/GeoJSON dodają `znacznik_aktualnosci`, `liczba_zrodel`, `zrodla_skladowe`, `dane_przykladowe`. Gdy jakikolwiek rekord jest demo, nazwa pliku ma przyrostek `_przykladowe`, a tytuł metryczki prefiks „[PRZYKŁADOWE]”.

### GET /health → 200
```json
{ "status": "ok", "service": "misja-aed-api", "wersja_api": "v1" }
```

### GET /meta/schema → 200
```json
{ "wersja": "xlsx",
  "pola": [ { "nazwa": "lat", "status": "wymagane", "typ": "liczba", "etykieta": "Szerokość geograficzna", "opis": "WGS84", "przyklad": "52.2286" } ],
  "zrodlo_pola": [ { "nazwa": "licencja", "status": "wymagane", "typ": "slownik", "etykieta": "Licencja", "opis": "…", "przyklad": "CC BY 4.0" } ],
  "pola_wyliczane": [ { "nazwa": "status_dostepnosci", "opis": "…" } ],
  "slowniki": { "dostepnosc": ["calodobowo", "w_godzinach", "nieznana"] } }
```
`pola` = pola rekordu AED (kolejność = kolejność kolumn eksportu), `zrodlo_pola` = opis źródła (formularz SourceScopeForm), `pola_wyliczane` = pola zwracane przez API, ale nie wpisywane przez dostawcę. Typy: `tekst`, `liczba`, `data`, `slownik`, `tak_nie`.
Wzorzec v0.2 dodaje `lokalizacja_w_obiekcie` („gdzie dokładnie”), `kod_pocztowy`, `data_ostatniego_przegladu`. Klucze JSON są zwracane w kolejności z XLSX.
Statusy pól: `wymagane`, `warunkowo_wymagane`, `opcjonalne`, `wyliczane`.

### GET /aed → 200
Query: `lat`, `lon` (razem, inaczej 400), `radius_m` (domyślnie 2000, maks. 20000), `tylko_aktualne` (bool), `limit` (50, maks. 200), `offset`. Przy `lat`+`lon` wynik jest sortowany po odległości.
Planowane (backend): `bbox`, `status_dostepnosci`, `dostepnosc_teraz`, `sort`.
```json
{ "items": [ {
    "aed_id": "AED-DEMO-0001", "lat": 52.2286, "lon": 21.0035,
    "adres": "Al. Przykładowa 1", "miasto": "Warszawa",
    "lokalizacja_w_obiekcie": "Hol główny, przy recepcji",
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
Błędy: 400 brak pól; 422 `INVALID_REGON` (długość/suma kontrolna); 401 `INVALID_CREDENTIALS`; 403 `PROVIDER_NOT_VERIFIED`. Konta demo: `python scripts/seed_providers.py` (hasło demo w README).

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

## Import z portalu dane.gov.pl (✅, dostęp: D)

Backend przeszukuje publiczne API portalu (`https://api.dane.gov.pl/1.4`, bez klucza) na poziomie **zasobów** i pobiera wyłącznie pliki hostowane przez portal (hosty `api.dane.gov.pl`/`dane.gov.pl`, także po przekierowaniach). Pobrane pliki trafiają do zwykłego przepływu partii (`mapping` → `process` → `commit`).

### GET /provider/danegov/catalog?refresh=true|false
Cache w pamięci 10 min; `refresh=true` wymusza ponowne pobranie. 200:
```json
{ "items": [ {
    "dataset_id": "3624", "tytul": "Defibrylatory zlokalizowane w Mieście Krosno",
    "strona_url": "https://dane.gov.pl/pl/dataset/3624,defibrylatory-zlokalizowane-w-miescie-krosno",
    "wydawca": { "nazwa": "Urząd Miasta Krosna", "regon": "000526989", "miasto": "Krosno" },
    "licencja": "CC0 1.0", "aktualizacja": "Nie dotyczy",
    "zasob": { "id": "54632", "tytul": "…", "format": "csv", "url": "https://api.dane.gov.pl/media/resources/…csv", "rozmiar": 2787, "data": "2024-02-19" },
    "inne_formaty": ["csv"], "mozna_importowac": true, "powod_pominiecia": null } ],
  "pobrano": "2026-11-22T03:00:00+01:00", "zrodlo": "https://api.dane.gov.pl/1.4" }
```
Wybór zasobu w zbiorze: priorytet `geojson > csv > xlsx > json` (XML/GML pomijane). Zasób będący linkiem do strony zewnętrznej (np. Warszawa) ma `mozna_importowac: false` i `powod_pominiecia`.
Błędy: 502 `UPSTREAM_ERROR`, 504 `UPSTREAM_TIMEOUT`.

### POST /provider/danegov/import
Request: `{ "zbiory": ["3624", "4581"] }` (1–10 identyfikatorów `dataset_id`). 201: jak `POST /provider/batches` (`batch_id`, `status: "wczytana"`, `zrodla[]`) oraz `pominiete: [{dataset_id, tytul, powod}]` (zbiory nieimportowalne lub z nieczytelnym plikiem – nie blokują pozostałych).
Opis źródła ustawiany automatycznie: `nazwa = "dane.gov.pl #{dataset_id}: {tytuł}"` (stała – ponowny import **aktualizuje** te same rekordy), `url` = strona zbioru, `licencja` z portalu, `prawo_do_udostepniania = licencja_zrodla_pozwala`, `dysponent_nazwa`/`dysponent_regon` = wydawca z portalu, `zakres_referencyjny.stan_na` = data zasobu, `dane_przykladowe = false`. Data publikacji w portalu **nie** jest datą potwierdzenia aktualności.
Błędy: 400 (zła lista), 422 `UNPROCESSABLE` (żaden zbiór nie nadaje się do importu; `details[]`), 502/504.

### Nowe reguły walidacji
| Kod | Poziom | Znaczenie |
|---|---|---|
| AED-COORD-003 | ostrzeżenie | wykryto odwrócone `lat`/`lon` i zamieniono je miejscami (np. nagłówek „Długość” przy wartościach szerokości) |
| AED-COORD-004 | ostrzeżenie | punkt leży >50 km od mediany pozostałych punktów tego samego źródła (min. 4 punkty) |

### Zmiany w odpowiedziach partii
- `zrodla[].kontrola_naglowkow.uwagi[]` (nowe): informacje o przetwarzaniu poza mapowaniem 1:1, np. „Adres zostanie złożony z kolumn …”, „Współrzędne … zostaną odczytane z kolumny geometry”, „plik CSV został rozpakowany”.
- Import akceptuje także pliki `.geojson` (traktowane jak JSON; współrzędne jako lista `[lon, lat]` lub obiekt `{lat, long}`).
- `source_record_id` bierze się z kolumny `id`/`numer_id`/`nr_id`/`identyfikator` (po normalizacji nazwy), inaczej `wiersz-N`.
