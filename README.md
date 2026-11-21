# Misja AED – Dane na ratunek (HackNation 2026)

Agregator danych o defibrylatorach AED: **Flask + SQLite** (backend) i **React + Vite** (frontend).
Architektura: dokumentacja v2; plan MVP: import → walidacja → zapis → mapa/lista → eksport.
Kontrakt API: [docs/api-contract.md](docs/api-contract.md). Wszystkie dane demo są fikcyjne.

## Struktura
- `backend/` – Flask (`app/api`, `app/services`, `app/storage`, `app/domain`), testy pytest, `data/standard/` (wzorzec XLSX)
- `frontend/` – React, React Router, Vite (`src/api`, `src/pages`, `src/components`, `src/auth`)
- `docs/api-contract.md` – wspólny kontrakt

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
**Obecny plik to tymczasowy szkic** (wygenerowany `backend/scripts/build_standard_stub.py` z pól dokumentacji v2) – należy go zastąpić oficjalnym wzorcem, zachowując układ zakładek.

## Stan prac
Działa: health, `/meta/schema`, `/aed`, `/aed/{id}`, eksport CSV/JSON (z SQLite), format błędów, REGON (składnia), `znacznik_aktualnosci`, serwowanie `dist`.
Szkielet (501): logowanie, partie (upload/process/commit).
Nie zaimplementowano: import, mapowanie, walidacja, deduplikacja, dostępność (`status_dostepnosci` = „nieznany”), mapa Leaflet, oświadczenia, historia, zgłoszenia, GeoJSON/XML.

## Podział pracy
- **Frontend** – tylko `frontend/`; kontrakt z `docs/api-contract.md`, mocki dozwolone. Mapa (react-leaflet), filtry, karta AED, panel importu, raport walidacji.
- **Backend** – tylko `backend/`; import/mapowanie/walidacja (`services/`), logowanie, partie, SQLite. Kontraktu nie zmieniać bez uzgodnienia.
