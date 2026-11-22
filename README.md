# Misja AED – Dane na ratunek (HackNation 2026)

Agregator danych o defibrylatorach AED: **Flask + SQLite** (backend) i **React + Vite** (frontend).
Architektura: dokumentacja v2; plan MVP: import → walidacja → zapis → mapa/lista → eksport.
Kontrakt API: [docs/api-contract.md](docs/api-contract.md). Wszystkie dane demo są fikcyjne.

## Struktura
- `backend/` – Flask (`app/api`, `app/services`, `app/storage`, `app/domain`), testy pytest, `data/standard/` (wzorzec XLSX)
- `frontend/` – React, React Router, Vite (`src/api`, `src/pages`, `src/components`, `src/auth`)
- `docs/api-contract.md` – wspólny kontrakt

## Szybki start – jedna komenda
```bash
./start.sh            # dev: backend :5000 + frontend :5173 (Ctrl+C zatrzymuje oba)
./start.sh --build    # buduje frontend i uruchamia tylko Flaska na :5000 (jeden adres)
```
Skrypt sam tworzy venv, instaluje zależności, zakłada konta demo i 15 fikcyjnych punktów AED. Konto: REGON `123456785`, hasło `demo-haslo-1`.

## Uruchomienie (dev) – dwa terminale
Wymagane: Python 3.11+, Node 18+.

**Backend** (http://127.0.0.1:5000)
```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python scripts/seed_demo.py     # opcjonalnie: 2 fikcyjne rekordy w SQLite
python run.py
pytest                          # testy
```
**Frontend** (http://localhost:5173, proxy `/api` → backend)
```bash
cd frontend
npm install
npm run dev
```
Strona `/` wywołuje `/api/v1/health` i `/api/v1/aed` i wyświetla odpowiedzi – to test integracji.

> **macOS:** AirPlay Receiver zajmuje `localhost:5000` (zwraca 403). Backend słucha na `127.0.0.1`, a proxy Vite też na `127.0.0.1`, więc dev działa. W razie kłopotów: `PORT=5001 python run.py` oraz `API_PORT=5001 npm run dev`.

## Prezentacja – jeden adres
```bash
cd frontend && npm run build
cd ../backend && python run.py   # Flask serwuje frontend/dist + /api/v1 na :5000
```

## Wzorzec XLSX
`backend/data/standard/Wzorcowy_zakres_danych_AED.xlsx` jest źródłem prawdy o polach (`domain/schema.py` czyta zakładki „Opis pól” i „Słowniki”).
**Wzorzec v0.2 jest generowany skryptem** ( `backend/scripts/build_standard_xlsx.py`).

## Konta demo i przepływ
```bash
cd backend && python scripts/seed_providers.py   # konta: 123456785 / 222222220 (zweryfikowane), 333333330 (nie); hasło: demo-haslo-1
```
Przepływ API: `login` → `POST /provider/batches` (multipart: `files`, `meta`) → `PUT .../mapping` → `POST .../process` → `GET .../report` → (`.../duplicates/decisions`) → `POST .../commit` → `GET /aed`, `GET /export/*`. Pliki do prób: `backend/data/sample_sources/`.

## Frontend – ekrany
| Trasa | Dostęp | Co robi |
|---|---|---|
| `/` | publiczna | wyszukiwanie AED: GPS lub współrzędne, filtry (promień, tylko dostępne teraz, tylko aktualne, statusy), lista + mapa OSM (na telefonie zakładki Lista/Mapa), karta punktu z czterema aspektami dostępności, tryb pilny, zgłoszenia z terenu, nawigacja |
| `/standard` | publiczna | tabele pól ze `/meta/schema` (pola rekordu, opis źródła, pola wyliczane), pobranie wzorca XLSX, instrukcja dla dostawcy |
| `/dostawca/logowanie` | publiczna | logowanie REGON + hasło |
| `/dostawca/agregacja` | dostawca | kreator: pliki + opis źródeł → mapowanie → raport walidacji → duplikaty → oświadczenia → zatwierdzenie → eksport |
| `/dostawca/dodaj` | dostawca | formularz AED generowany ze schematu XLSX, walidacja na żywo, tryb edycji (`?aed=ID`) |
| `/dostawca/punkty` | dostawca | własne punkty, historia zmian, wycofanie |

Testy frontendu: `cd frontend && npm test` (vitest; logika, formularze, strony na zamockowanym API). Ograniczenia: brak automatycznych testów w prawdziwej przeglądarce (mapa Leaflet jest zamockowana w testach), brak geokodowania adresu (lokalizacja: GPS, współrzędne lub kliknięcie w mapę), tabela mapowania nie pokazuje przykładowych wartości z pliku (API ich nie zwraca).

## Stan prac
Backend (Etapy 1–8) zaimplementowany i pokryty testami (`pytest`): import CSV/JSON/XLSX (kodowanie, separator, kontrola nagłówków), auto-mapowanie, walidacja (reguły AED-*), duplikaty z ręczną decyzją, zatwierdzenie z oświadczeniami, historia, logowanie dostawcy, zgłoszenia oddolne (osobna tabela), `status_dostepnosci`, eksport CSV/JSON/GeoJSON/ZIP + metryczka.
Ograniczenia: weryfikacja dostawcy symulowana seedem; metryczka XML nie jest zwalidowana względem XSD (brak pliku); licencja/region/kategoria zbioru czekają na decyzję D9; limit zgłoszeń w pamięci procesu; geokodowania adresów brak (rekord bez współrzędnych nie przejdzie zatwierdzenia). Frontend: szkielet (mapa, panel importu i formularz do zrobienia).

## Podział pracy
- **Frontend** – tylko `frontend/`; kontrakt z `docs/api-contract.md`, mocki dozwolone. Mapa (react-leaflet), filtry, karta AED, panel importu, raport walidacji.
- **Backend** – tylko `backend/`; import/mapowanie/walidacja (`services/`), logowanie, partie, SQLite. Kontraktu nie zmieniać bez uzgodnienia.

Po zmianie pól uruchom `python scripts/build_standard_xlsx.py` (backend). Dane demo: `scripts/seed_demo.py` (15 rekordów) i `scripts/build_sample_sources.py` (5 plików w `data/sample_sources/`). Mocki odpowiedzi: `docs/examples/`. Decyzje otwarte: `docs/decisions.md`.
