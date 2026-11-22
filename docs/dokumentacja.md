# Minuta do AED – pełna dokumentacja

> Krótki opis dla jury: [README.md](../README.md). Linki względne poniżej liczone od katalogu głównego repozytorium.

**Akcja i prototyp w ramach zadania „Misja AED – Dane na ratunek” (HackNation 2026, Ministerstwo Cyfryzacji).**

> **Hasło akcji:** nie zostało jeszcze ustalone (zespół celowo go nie wymyślał na potrzeby prototypu).
> **Wszystkie dane „przykładowe” w aplikacji są fikcyjne i oznaczone w interfejsie oraz w eksporcie.**

Przy nagłym zatrzymaniu krążenia liczy się każda minuta, a defibrylatora AED może użyć każdy – o ile wie, gdzie go szukać, czy jest dostępny i czy działa. Dziś nie istnieje kompletna mapa AED: dane są rozproszone między instytucjami, niepełne i nieujednolicone. **Minuta do AED** pokazuje, jak zebrać je w jednym, otwartym, odczytywalnym maszynowo zbiorze gotowym do udostępnienia w portalu [dane.gov.pl](https://dane.gov.pl) – i od razu pożytkować go w mapie dla obywatela.

| | |
|---|---|
| **Użytkownicy** | obywatel i ratownik szukający najbliższego AED · dostawca danych (podmiot z REGON), który zbiera i udostępnia dane o AED |
| **Co dostarczamy** | prototyp (Flask + SQLite, React) · wzorcowy zakres danych (XLSX) · eksport CSV/JSON/GeoJSON z metryczką · mapa z dostępnością w czterech aspektach · deklarację dostępności |
| **Stan** | działający prototyp end-to-end: źródło → mapowanie → walidacja → duplikaty → oświadczenia → zatwierdzenie → mapa i eksport |

---

## Spis treści
1. [Rozwiązanie i wartość dla dane.gov.pl](#1-rozwiązanie-i-wartość-dla-danegovpl)
2. [Wzorcowy zakres danych AED](#2-wzorcowy-zakres-danych-aed)
3. [Funkcjonalności i ścieżki użytkownika](#3-funkcjonalności-i-ścieżki-użytkownika)
4. [Architektura i zgodność ze standardami](#4-architektura-i-zgodność-ze-standardami)
5. [Szybkie uruchomienie (Quickstart)](#5-szybkie-uruchomienie-quickstart)
6. [Identyfikacja wizualna akcji](#6-identyfikacja-wizualna-akcji)
7. [Znane ograniczenia i dalszy rozwój](#7-znane-ograniczenia-i-dalszy-rozwój)
8. [Wykorzystanie sztucznej inteligencji](#8-wykorzystanie-sztucznej-inteligencji)
9. [Licencja i prawa autorskie](#9-licencja-i-prawa-autorskie)

---

## 1. Rozwiązanie i wartość dla dane.gov.pl

**Problem.** Dane o AED mają różni dysponenci (urzędy, szkoły, dworce, firmy) w różnych formatach, kodowaniach i układach kolumn. Brakuje jednolitego opisu, informacji o pochodzeniu danych, aktualności i realnej dostępności urządzenia (czy to szafka zamknięta na klucz, czy urządzenie w holu dostępne całą dobę).

**Rozwiązanie.** Aplikacja jest narzędziem dla **dostawcy danych** (zweryfikowanego podmiotu z REGON), który:

1. wczytuje jedno lub wiele źródeł (CSV, JSON/GeoJSON, XLSX albo bezpośrednio z portalu dane.gov.pl) wraz z opisem źródła, licencją i zakresem referencyjnym,
2. mapuje kolumny na jednolity schemat (propozycja automatyczna + ręczna korekta),
3. waliduje dane 18 regułami o kodach `AED-*` (błąd blokuje zatwierdzenie, ostrzeżenie nie),
4. wykrywa duplikaty (w partii i względem bazy) – **nigdy nie scala ich automatycznie**,
5. zatwierdza dane po złożeniu oświadczeń (prawdziwość danych, prawo do udostępniania),
6. udostępnia zatwierdzone dane w mapie oraz w eksporcie **CSV / JSON / GeoJSON** z metryczką zbioru.

**Wartość dla dane.gov.pl.**

- **Jeden, jednolity zbiór z wielu źródeł** – każdy rekord zachowuje wszystkie źródła składowe wraz z zakresem referencyjnym, licencją i podmiotem zarządzającym danymi (`zrodla.csv`, `aed_zrodla.csv`, pole `zrodla_skladowe` w JSON).
- **Wzorcowy zakres danych** (XLSX) – wszyscy dysponenci mogą dostarczać dane w ten sam sposób; schemat jest jedynym źródłem prawdy dla backendu, formularzy i testów.
- **Formaty odczytywalne maszynowo** – eksport w CSV (UTF-8) i JSON/GeoJSON; PDF i DOC są odrzucane jako dane (HTTP 415 z komunikatem).
- **Rozróżnienie danych oficjalnych i uwag oddolnych** – zgłoszenia z terenu trafiają do osobnej tabeli i **nigdy nie zmieniają** rekordu oficjalnego, statusu ani eksportu.
- **Uczciwość co do jakości** – brak informacji jest zawsze „nieznany”/„niepotwierdzone”, nigdy „niedostępny”; poprawki danych źródłowych są jawne i raportowane.
- **Weryfikacja na prawdziwych danych** – aplikacja pobiera lokalizacje AED opublikowane już na dane.gov.pl (publiczne API, bez klucza) i przepuszcza je przez ten sam proces walidacji (stan na 22.11.2026: 4 pobieralne zbiory – Krosno, Przemyśl, Marki, Legionowo – razem 74 punkty; zasób Warszawy jest tylko linkiem do strony i nie da się go pobrać przez portal).

> **Zatwierdzenie ≠ eksport ≠ publikacja.** „Zatwierdzenie” oznacza zatwierdzenie danych przez dostawcę w bazie prototypu. Pobranie plików z `/export/*` nie jest publikacją w dane.gov.pl, a prototyp nie wysyła niczego do portalu i nie wie, czy dostawca opublikował paczkę. API zwraca `"publikacja_dane_gov_pl": "nie_opublikowano_przez_prototyp"`.

---

## 2. Wzorcowy zakres danych AED

Plik: [`backend/data/standard/Wzorcowy_zakres_danych_AED.xlsx`](backend/data/standard/Wzorcowy_zakres_danych_AED.xlsx) – generowany skryptem [`backend/scripts/build_standard_xlsx.py`](backend/scripts/build_standard_xlsx.py). Backend czyta z niego nazwy pól, statusy i słowniki przy starcie (`app/domain/schema.py`); ten sam schemat zasila `GET /api/v1/meta/schema`, formularz AED, stronę „Standard danych” i testy zgodności (CSV i JSON mają kolumny dokładnie w kolejności z XLSX). Szablon do pobrania: `GET /api/v1/standard/template.xlsx`.

**Zakładki:** `Opis pól` · `Słowniki` · `Źródła` · `Dane` (arkusz do importu, 22 kolumny) · `Przykładowe dane` (fikcyjne) · `Pola wyliczane` · `Instrukcja`.

**24 pola rekordu: 16 wymaganych, 1 warunkowo wymagane, 5 opcjonalnych, 2 wyliczane.**

| Grupa | Pola | Uwagi |
|---|---|---|
| Lokalizacja | `lat`, `lon`, `adres`, `kod_pocztowy`, `miasto`, **`lokalizacja_w_obiekcie`** | „gdzie dokładnie jest urządzenie” (np. hol przy recepcji) |
| **Cztery aspekty dostępności** | `dostepnosc` + `godziny_dostepu` · `bariera_dostepu` · `ograniczenia_dostepu` + `ograniczenia_opis` · `stan` | godziny w składni `opening_hours` (podzbiór: `24/7`, zakresy dni, kilka reguł, `off`); każdy aspekt może być „nieznany” |
| Aktualność (trzy niezależne daty) | `data_ostatniego_potwierdzenia`, `data_ostatniej_edycji`*, `data_importu`*, `data_ostatniego_przegladu` | *wyliczane przez system; potwierdzenie ustawia tylko jawne działanie dostawcy |
| Pochodzenie | `nazwa_dostawcy`, `regon_dostawcy`, `dysponent_nazwa`, `dysponent_regon`, `zrodlo_danych`, `zakres_referencyjny`, `oswiadczenie_prawdziwosci` | trzy role: dostawca, podmiot zarządzający danymi (dysponent), źródło |
| Identyfikator | `aed_id` | nadawany przez system |

**Opis źródła** (zakładka `Źródła`): `nazwa`, `url`, `licencja`, `prawo_do_udostepniania` (`dane_wlasne` / `zgoda_dysponenta` / `licencja_zrodla_pozwala` / `nieustalone`), `podstawa_prawa_opis`, `dysponent_nazwa`, `dysponent_regon`, `zakres_referencyjny`, `dane_przykladowe`. **Pola wyliczane** (nie należą do wzorca, liczy je serwer): `status_dostepnosci`, `znacznik_aktualnosci`, `odleglosc_m`, `sygnaly`, `zrodla_skladowe`, `liczba_zrodel`, `konflikty`, `dane_przykladowe`.

**Walidacja – 18 reguł** (`backend/app/domain/rules.py`): brak pól krytycznych i wymaganych, wartości spoza słownika, współrzędne (format, poza Polską, **odwrócone lat/lon – zamieniane jawnie z ostrzeżeniem**, punkt odstający od reszty źródła), godziny dostępu, formaty i przyszłe daty, aktualność (próg 365 dni, konfigurowalny `PROG_AKTUALNOSCI_DNI`), REGON dostawcy, brak oświadczeń, źródło bez zakresu referencyjnego, brak licencji lub `prawo_do_udostepniania = nieustalone`, nierozstrzygnięty duplikat.

**Status dostępności** (`status_dostepnosci`) liczy backend z czterech aspektów w strefie `Europe/Warsaw`: `dostepny` · `ograniczony_dostep` · `niedostepny` · `nieznany`. Brak informacji prowadzi do `nieznany`, nigdy do `niedostepny`.

Szczegóły i decyzje otwarte: [`docs/decisions.md`](docs/decisions.md) (D1–D15), kontrakt API: [`docs/api-contract.md`](docs/api-contract.md), przykładowe odpowiedzi: [`docs/examples/`](docs/examples/).

---

## 3. Funkcjonalności i ścieżki użytkownika

### 3.1. Obywatel / ratownik – mapa AED (`/`, bez logowania)

1. Po wejściu aplikacja prosi o lokalizację (GPS). Przy odmowie pokazuje całą Polskę i wyjaśnia, że odległości nie są liczone. Pozycja GPS **nie trafia do adresu URL ani do zapytań** do serwera.
2. Mapa pokazuje **wszystkie zatwierdzone punkty naraz** (bez promienia). Blisko leżące punkty łączą się w okręgi z liczbą AED; **kolor okręgu = przeważający rodzaj punktów w skupisku**. Przybliżenie rozdziela skupiska.
3. Kolory pinezek: 🟢 działa · 🟡 działa w określonych godzinach lub z ograniczeniem dostępu · 🔴 nie działa · ⚪ „?” brak danych (symbol, nie tylko kolor).
4. Panel boczny (na telefonie wysuwany od dołu, zwijany) ma licznik, wyszukiwarkę (adres, miasto, miejsce w obiekcie), filtry („ukryj niedostępne”, „tylko aktualne”, statusy) i listę posortowaną wg odległości, gdy znamy pozycję.
5. Kliknięcie pinezki lub pozycji na liście przelatuje do punktu i otwiera **kafelek przypięty do markera**: adres, wyróżnione `lokalizacja_w_obiekcie`, cztery aspekty dostępności w siatce 2×2, odległość, przycisk **Nawiguj** (link do trasy), **Szczegóły** (trzy daty, dostawca, dysponent, źródło i zakres referencyjny, źródła składowe) oraz **Zgłoś z terenu**. Zamknięcie: `×` lub `Escape`.
6. Punkt `niedostepny` / `ograniczony_dostep` pokazuje powód i proponuje następny punkt z listy; „brak danych” jest opisany neutralnie, jako brak informacji.
7. **Zgłoszenie z terenu** (zamknięte na klucz / potwierdzam obecność / brak urządzenia / uszkodzone, komentarz do 300 znaków, limit 5/h na adres IP) trafia do osobnej warstwy i nie zmienia rekordu oficjalnego.

### 3.2. Dostawca danych – import wielu źródeł (`/dostawca/agregacja`)

1. **Logowanie** (`/dostawca/logowanie`): REGON + hasło. REGON jest sprawdzany tylko składniowo (długość i suma kontrolna) – to nie jest potwierdzenie tożsamości. Konto musi mieć status „zweryfikowany”.
2. **Źródła:** pliki CSV / JSON / GeoJSON / XLSX (1–10, do 5 MB) **albo** zakładka „Z portalu dane.gov.pl” (katalog zbiorów, import zaznaczonych). Dla każdego źródła: nazwa, URL, licencja, prawo do udostępniania, podmiot zarządzający danymi, zakres referencyjny, flaga danych przykładowych. PDF/DOC → komunikat, że to nie jest dopuszczalny format danych.
3. **Mapowanie:** wykryte kodowanie (UTF-8, cp1250, iso-8859-2) i separator, kontrola nagłówków (brakujące, nadmiarowe, powtórzone), propozycja mapowania z oceną pewności; zatwierdzone mapowanie jest zapamiętywane dla źródła.
4. **Raport walidacji:** błędy i ostrzeżenia z kodem reguły, polem i rekordem; filtr poziomu; pobranie raportu CSV/JSON.
5. **Duplikaty:** kandydaci w partii i względem bazy (odległość ≤ 30 m, podobieństwo adresu ≥ 0,8), obok siebie, z decyzją „scal” / „zostaw oba”. Domyślnie nic nie jest scalane; scalenie z rekordem innego dostawcy jest zablokowane (`MERGE_FOREIGN_RECORD`).
6. **Oświadczenia i zatwierdzenie:** dwa wymagane oświadczenia (prawdziwość danych, prawo do udostępniania) i jedno opcjonalne (potwierdzenie aktualności – tylko ono ustawia `data_ostatniego_potwierdzenia`). Opcja odrzucenia rekordów z błędami. Oświadczenia i historia zmian są **tylko do dopisywania**.
7. **Eksport:** CSV, JSON, GeoJSON, ZIP z paczką, `zrodla.csv`, `aed_zrodla.csv`, metryczka JSON/XML. Przy danych przykładowych tytuł metryczki ma przedrostek „[PRZYKŁADOWE]”, a nazwy plików przyrostek `_przykladowe`.

### 3.3. Dostawca – pojedynczy punkt (`/dostawca/dodaj`, `/dostawca/punkty`)

- Formularz jest **generowany ze schematu XLSX**, z walidacją na żywo tymi samymi regułami co import. Pozycję ustawia GPS (automatycznie), kliknięcie w mapę lub przeciągnięcie pinezki; współrzędne ręczne są w zwijanej sekcji. Pola słownikowe domyślnie mają „nieznane” (brak fałszowania dostępności).
- „Moje punkty”: edycja, historia zmian i deklaracji (odczyt), wycofanie punktu (znika z mapy i eksportu, historia zostaje).

### 3.4. Pozostałe widoki

| Trasa | Dostęp | Zawartość |
|---|---|---|
| `/standard` | publiczna (link w menu po zalogowaniu) | tabele pól ze schematu, pobranie wzorca XLSX, instrukcja dla dostawcy |
| `/deklaracja-dostepnosci` | publiczna (menu „Dostępność”, stopka) | deklaracja dostępności z wynikiem kontroli kontrastu liczonym na żywo |

---

## 4. Architektura i zgodność ze standardami

```
 React + Vite + Leaflet  ──/api/v1──►  Flask 3 (blueprinty)  ──►  SQLite (sqlite3, bez ORM)
 (frontend/)                            api/ services/ domain/       data/aed.db (poza repozytorium)
        ▲                                   │  schema ◄── Wzorcowy_zakres_danych_AED.xlsx
        └── w produkcji Flask serwuje też frontend/dist (jeden origin, bez CORS)
                                            └── api.dane.gov.pl (pobieranie otwartych danych, TLS, tylko hosty portalu)
```

| Warstwa | Technologia |
|---|---|
| Backend | Python 3.11+, Flask 3 (blueprinty `api/`: `aed_public`, `provider`, `provider_aed`, `danegov`, `export`, `meta`), `openpyxl` (odczyt/zapis XLSX), `tzdata`, `certifi` |
| Logika | `services/`: `ingest`, `mapping`, `validation`, `dedupe`, `freshness`, `availability`, `regon`, `pipeline`, `export`, `danegov`, `declarations`, `geo`, `geo_parse` · `domain/`: `schema`, `rules` |
| Baza | SQLite (`sqlite3`): dostawcy, źródła, partie, rekordy robocze, kandydaci na duplikaty, `aed`, `aed_sources`, `aed_history`, `declarations`, `field_reports`; historia i deklaracje tylko do dopisywania |
| Uwierzytelnianie | hasło (`werkzeug.security`) + podpisany token (`itsdangerous`, ważność 8 h); REGON sprawdzany składniowo |
| Frontend | React 18, React Router 6, Vite 5, Leaflet + react-leaflet, `leaflet.markercluster`, kafelki OpenStreetMap; bez zewnętrznej biblioteki UI |
| Kontrakt | prefiks `/api/v1`, JSON UTF-8, daty ISO 8601, nazwy pól jak w XLSX, jednolity błąd `{error: {code, message, details}}`; **frontend nie liczy statusu dostępności ani aktualności – robi to backend** |

### Zgodność z zasadami dane.gov.pl i formatami maszynowymi
- Eksport: **CSV** (UTF-8, separator `;` z konfiguracji `CSV_DELIMITER`), **JSON**, **GeoJSON**; PDF/DOC/XLS odrzucane jako dane. Import: CSV, JSON/GeoJSON, XLSX.
- Metryczka zbioru i zasobów w JSON i XML (tytuł, opis, `updateFrequency`, kategoria, tagi, licencja, regiony, `lastUpdateDate`, zasoby z formatem) – kształt zgodny z konwencjami portalu wyniesionymi z jego otwartego kodu; **XML nie jest zwalidowany względem XSD harvestera** (pliku XSD nie ma w repozytorium), a licencja zbioru zbiorczego, kategoria i regiony czekają na decyzję (D9).
- Konwencje portalu uwzględnione w imporcie: kontrola nagłówków plików tabelarycznych, obsługa kodowania Windows-1250, lista licencji (CC0 1.0, CC BY 4.0 itd.).
- Pobieranie z portalu: publiczne API 1.4 bez klucza, weryfikacja TLS zawsze włączona, tylko hosty portalu (także po przekierowaniach), limit 10 MB, timeouty i ponowienia, neutralny `User-Agent`.

### Dostępność (WCAG), responsywność, UX
- **Menu „Dostępność”** w pasku górnym: rozmiar tekstu 100–175%, wysoki kontrast (czarno-żółty), podkreślenie linków, większe odstępy w tekście, czcionka systemowa, wyłączenie animacji (łącznie z przelotem mapy); ustawienia pamiętane w przeglądarce.
- **Deklaracja dostępności** (`/deklaracja-dostepnosci`): stan „**częściowo zgodna**” z WCAG 2.1 AA, lista treści niedostępnych i udogodnień. Pola kontaktowe i data publikacji są oznaczone „do uzupełnienia” – nie wymyślaliśmy ich.
- **Kontrast sprawdzany automatycznie:** `cd frontend && npm run a11y:contrast` – 52 pary kolorów (tryb standardowy i wysoki kontrast; progi 4,5:1 dla tekstu i 3:1 dla elementów graficznych), wynik w [`docs/raport-kontrastu.md`](docs/raport-kontrastu.md). To samo sprawdzenie działa w testach.
- Nawigacja klawiaturą, widoczny `:focus-visible`, link „Przejdź do treści”, powiązane etykiety `<label for>`, komunikaty błędów z `aria-*`, cele dotykowe ≥ 44 px, pola ≥ 16 px (brak auto-zoomu na iOS), status zawsze tekstem i symbolem, nie tylko kolorem.
- **Responsywność:** pełnoekranowa mapa z panelem bocznym na komputerze; na telefonie menu hamburger, panel listy od dołu, tabele przewijane poziomo. Układ sprawdzony na zrzutach z emulacji 320/390/768/1280 px.
- Mapa jest elementem graficznym – jej tekstowym odpowiednikiem jest lista punktów z tymi samymi danymi.

### Testy automatyczne

| Zakres | Polecenie | Wynik (stan repozytorium) |
|---|---|---|
| Backend (schemat zgodny z XLSX, reguły, import, mapowanie, duplikaty, przepływ partii, logowanie, zgłoszenia niezmieniające rekordu, eksport, import z dane.gov.pl) | `cd backend && pytest` | **75 testów przechodzi** |
| Frontend (logika, formularze, strony, mapa listowa, menu dostępności, deklaracja, kontrast) | `cd frontend && npm test` | **55 testów przechodzi** |
| Kontrast kolorów | `cd frontend && npm run a11y:contrast` | 52/52 par spełnia próg |

Nie ma testów end-to-end w prawdziwej przeglądarce; mapa Leaflet jest w testach zamockowana (jej wygląd sprawdzano ręcznie na zrzutach).

### Struktura repozytorium
```
backend/   app/{api,services,domain,storage}  scripts/  data/{standard,sample_sources}  tests/
frontend/  src/{api,a11y,auth,components,hooks,lib,pages,styles,test}  public/logo.png  scripts/
docs/      api-contract.md  decisions.md  raport-kontrastu.md  examples/
start.sh   LICENSE   README.md
```

---

## 5. Szybkie uruchomienie (Quickstart)

Wymagane: **Python 3.11+**, **Node 18+**, bash (macOS/Linux; na Windows użyj uruchomienia ręcznego lub WSL).

```bash
git clone https://github.com/exmanek/minuta-do-aed.git
cd minuta-do-aed
./start.sh            # dev: backend :5000 + frontend :5173 (Ctrl+C zatrzymuje oba)
./start.sh --build    # buduje frontend i uruchamia tylko Flaska na :5000 – jeden adres
```

Skrypt sam tworzy `venv`, instaluje zależności backendu i frontendu, zakłada konta demo i **15 fikcyjnych punktów AED**. Otwórz **http://localhost:5173** (dev) albo **http://127.0.0.1:5000** (`--build`).

**Konta demo** (hasło: `demo-haslo-1`; REGON-y mają poprawny format, nie należą do prawdziwych podmiotów):

| REGON | Nazwa | Status |
|---|---|---|
| `123456785` | Dostawca Demo 1 | zweryfikowany |
| `222222220` | Dostawca Demo 2 | zweryfikowany |
| `333333330` | Dostawca Demo (niezweryfikowany) | założony (logowanie zwraca 403) |

**Ręcznie (dwa terminale):**
```bash
# backend → http://127.0.0.1:5000
cd backend && python3 -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
python scripts/seed_providers.py && python scripts/seed_demo.py
python run.py
# frontend → http://localhost:5173 (proxy /api → backend)
cd frontend && npm install && npm run dev
```
> macOS: AirPlay Receiver zajmuje `localhost:5000`; backend i proxy Vite używają `127.0.0.1`. W razie kłopotów: `PORT=5001 ./start.sh`.

### Prawdziwe dane z dane.gov.pl
Baza (`backend/data/aed.db`) nie jest w repozytorium, więc świeże uruchomienie pokazuje tylko 15 punktów demo. Prawdziwe lokalizacje (wymaga internetu):

- **z interfejsu:** zaloguj się → *Import* → zakładka „Z portalu dane.gov.pl” → zaznacz zbiory → kreator (mapowanie, raport, duplikaty, oświadczenia, zatwierdzenie),
- **ze skryptu:**
  ```bash
  cd backend && source venv/bin/activate
  HARVEST_PASSWORD=demo-haslo-1 python scripts/harvest_danegov.py --regon 123456785 --dry-run
  HARVEST_PASSWORD=demo-haslo-1 python scripts/harvest_danegov.py --regon 123456785 --commit --accept-declarations --reject-invalid
  ```
  Zatwierdzenie wymaga jawnej flagi `--accept-declarations` (składasz oświadczenia dostawcy); ponowne uruchomienie **aktualizuje** te same rekordy.

### Sprawdzenie w 2 minuty
1. Otwórz mapę → kliknij skupisko, a potem pinezkę → kafelek z „Gdzie dokładnie” i czterema aspektami.
2. Menu **Dostępność** (powiększenie tekstu, wysoki kontrast) i **Deklaracja dostępności**.
3. Zaloguj się kontem demo → *Import* → wgraj plik z `backend/data/sample_sources/` (5 scenariuszy: wzorzec, cp1250, OSM JSON, duplikaty, XLSX) → mapowanie → raport → zatwierdź → punkt na mapie → eksport CSV/JSON.
4. *Standard danych* → pobierz wzorzec XLSX.

---

## 6. Identyfikacja wizualna akcji

- **Nazwa akcji:** Minuta do AED.
- **Hasło:** nie zostało ustalone.
- **Logotyp:** [`frontend/public/logo.png`](frontend/public/logo.png) (PNG; użyty w aplikacji i jako ikona karty). Wymagane przez zadanie formaty **.jpg, .pdf oraz format otwarty (np. SVG)** oraz **księga znaku w PDF** (kolorystyka, pole ochronne, minimalna wielkość, niedozwolone użycia, 3–5 zdań koncepcji) **nie są jeszcze częścią repozytorium** – `[UZUPEŁNIJ: dołączyć pliki]`.
- **System wizualny interfejsu** (tokeny w `frontend/src/styles/tokens.css`): krój Archivo Black / Archivo / JetBrains Mono, akcent ratunkowy `#E11D48`, akcent danych `#2563EB`, statusy w odcieniach zielonego, żółtego, czerwonego i neutralnego szarego dla braku danych.

---

## 7. Znane ograniczenia i dalszy rozwój

### Ograniczenia
**Dane i proces**
- **Weryfikacja dostawcy jest symulowana.** Konta demo zakłada skrypt, status „zweryfikowany” nadaje seed; REGON jest sprawdzany tylko składniowo (brak integracji z GUS/CEIDG). Prototyp nie sprawdza, czy urządzenie fizycznie istnieje i działa – ręczy za to dostawca oświadczeniem.
- **Brak publikacji w dane.gov.pl.** Prototyp przygotowuje paczkę i metryczkę; dostawca publikuje je samodzielnie. Metryczka XML nie jest zwalidowana względem XSD; licencja zbioru zbiorczego, kategoria i regiony czekają na decyzję (D9).
- **Dane z portalu są ubogie:** źródła nie zawierają dostępności, stanu ani potwierdzenia aktualności, więc punkty mają „brak danych o dostępności” i „niepotwierdzone”. Dane źródłowe bywają błędne (w Markach współrzędne są odwrócone – wykrywamy i raportujemy). Zbiory bez kolumny identyfikatora są rozróżniane numerem wiersza (zmiana kolejności może utworzyć nowe rekordy zamiast aktualizacji). Zasób Warszawy jest tylko linkiem. Brak harmonogramu pobierania w aplikacji (użyj crona).
- **Brak geokodowania adresów.** Współrzędne są polem krytycznym: rekord bez nich nie przejdzie zatwierdzenia (lokalizacja: GPS, kliknięcie w mapę lub wpis ręczny).
- **Deduplikacja jest heurystyczna** (30 m + podobieństwo adresu) i wymaga decyzji człowieka; może pominąć duplikat lub zaproponować błędną parę. Scalanie z rekordami innych dostawców jest zablokowane.
- **Status dostępności wynika z deklaracji dostawcy.** Parser godzin obsługuje tylko podzbiór składni `opening_hours`. Walidacja geograficzna używa przybliżonego prostokąta Polski.
- **Zgłoszenia oddolne bez moderacji;** limit 5/h na adres IP trzymany w pamięci procesu.
- **Treść oświadczeń jest robocza** i wymaga akceptacji prawnej przed użyciem produkcyjnym (D10).
- **Skala:** SQLite, przetwarzanie synchroniczne w jednym żądaniu, frontend pobiera wszystkie punkty (stronami po 200) i grupuje je w przeglądarce – wystarcza do tysięcy punktów, nie do setek tysięcy.

**Interfejs i jakość**
- Mapa wymaga internetu (kafelki OpenStreetMap); nawigacja to link do zewnętrznej trasy, nie własny routing.
- Dostępność: brak formalnego audytu i testów z osobami z niepełnosprawnościami oraz z czytnikami ekranu; skupiska i pinezki mapy nie były w ten sposób testowane; deklaracja ma status „częściowo zgodna”.
- Brak testów end-to-end w przeglądarce (Leaflet zamockowany w testach).
- Aplikacja **nie zastępuje numeru alarmowego 112.**

**Elementy zgłoszenia poza repozytorium (do uzupełnienia):** hasło akcji, księga znaku i pozostałe formaty logotypu, prezentacja (min. 5 slajdów ze zrzutami ekranu), dane autorów.

### Kierunki rozwoju
1. Geokodowanie adresów (rekord z samym adresem), co pozwoliłoby uprościć szablon XLSX do wersji podstawowej z listami rozwijanymi.
2. Docelowe uwierzytelnianie dostawcy i weryfikacja REGON w rejestrach (D1).
3. Walidacja metryczki XML względem XSD harvestera oraz automatyczne przygotowanie zbioru do publikacji w dane.gov.pl.
4. Cykliczne pobieranie zbiorów z portalu i powiadamianie dostawców o starzejących się danych.
5. Moderacja zgłoszeń z terenu i trwały limit nadużyć.
6. Serwerowe grupowanie punktów (`bbox`) dla bardzo dużych zbiorów; baza serwerowa zamiast SQLite.
7. Niezależny audyt dostępności i testy z użytkownikami; testy end-to-end w przeglądarce.

---

## 8. Wykorzystanie sztucznej inteligencji

Zgodnie z § 2 ust. 7–8 Regulaminu Zadania wskazujemy zakres użycia AI.

**Narzędzie:** asystent AI **Claude (Anthropic)**, w tym Claude Code, jako narzędzie pomocnicze zespołu.

**Zakres użycia AI:**
- analiza treści zadania i regulaminu oraz przegląd konwencji otwartego kodu portalu dane.gov.pl (lista licencji, schematy metadanych, wzorce walidacji plików),
- propozycje schematu danych, słowników i reguł walidacji,
- **pisanie i refaktoryzacja znacznej części kodu** backendu i frontendu, testów, skryptów oraz danych przykładowych,
- redakcja dokumentacji, w tym tego pliku, deklaracji dostępności i raportu kontrastu.

**Praca zespołu:** założenia biznesowo-prawne (w tym ustalenia z mentorem), kierunek rozwiązania i decyzje projektowe (D1–D15), wybór zakresu pól i progów, przegląd kodu, uruchamianie i testowanie aplikacji oraz zatwierdzenie wersji końcowej. Zespół odpowiada za treść i działanie rozwiązania. `[UZUPEŁNIJ: narzędzia AI użyte poza kodem – logotyp, księga znaku, prezentacja, teksty – oraz potwierdzenie przez zespół opisu własnego wkładu]`.

Ograniczenia i niepewności wynikające z pracy z AI są opisane wprost (m.in. sekcja 7); nie deklarujemy funkcji, których nie ma w kodzie.

---

## 9. Licencja i prawa autorskie

- **Kod i dokumentacja zespołu:** licencja **MIT** – zob. [`LICENSE`](LICENSE) (© 2026 Zespół „Minuta do AED”). `[UZUPEŁNIJ: imiona i nazwiska autorów oraz podział wkładu]`.
- **Przeniesienie praw.** Zgodnie z § 4 Regulaminu Zadania zwycięski zespół przenosi autorskie prawa majątkowe do rozwiązania na Ministra Cyfryzacji **odrębną umową pisemną** podpisaną przez wszystkich współtwórców. Licencja MIT w repozytorium **nie zastępuje tej umowy**. Czy publiczna licencja MIT jest zgodna z zamiarem przeniesienia praw na Ministra Cyfryzacji, warto potwierdzić z organizatorem.
- **Dane demonstracyjne** są fikcyjne (oznaczone `dane_przykladowe`). **Dane z dane.gov.pl** pobrane do bazy pozostają na licencjach wskazanych przez ich wydawców w portalu (rekord zachowuje nazwę licencji źródła; inna niż CC0 1.0 / CC BY 4.0 blokuje import do decyzji); atrybucja jest zachowana w `zrodla.csv` i JSON. Baza danych nie jest częścią repozytorium.
- **Mapa:** © współtwórcy OpenStreetMap (dane na licencji ODbL), atrybucja jest widoczna na mapie.
- **Składniki zewnętrzne** (licencje potwierdzone w zainstalowanych pakietach):

| Składnik | Licencja |
|---|---|
| Flask | BSD-3-Clause |
| openpyxl, pytest | MIT |
| tzdata | Apache-2.0 |
| certifi | MPL-2.0 |
| React, React DOM, React Router, leaflet.markercluster, Vite, Vitest, jsdom, Testing Library | MIT |
| Leaflet | BSD-2-Clause |
| **react-leaflet** i `@react-leaflet/core` | **Hippocratic License 2.1** (licencja „etyczna”, nie jest zatwierdzona przez OSI – zespół powinien potwierdzić jej zgodność z § 4 Regulaminu albo zastąpić wiązanie bezpośrednim użyciem Leaflet) |
| Czcionki Archivo, Archivo Black, JetBrains Mono (Google Fonts) | SIL Open Font License 1.1 |
