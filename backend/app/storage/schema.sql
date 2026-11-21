-- Struktura wg dokumentacji v2, pkt 4.2. Pełny rekord AED w payload_json (klucze = nazwy z XLSX).
CREATE TABLE IF NOT EXISTS providers (
  regon TEXT PRIMARY KEY, nazwa TEXT NOT NULL, haslo_hash TEXT NOT NULL,
  status_weryfikacji TEXT NOT NULL DEFAULT 'zalozony' CHECK (status_weryfikacji IN ('zalozony','zweryfikowany')),
  zweryfikowano_kiedy TEXT, utworzono TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY, regon_dostawcy TEXT NOT NULL REFERENCES providers(regon),
  nazwa TEXT NOT NULL, url TEXT, format TEXT CHECK (format IN ('csv','json','xlsx')),
  licencja TEXT, prawo_do_udostepniania TEXT, podstawa_prawa_opis TEXT,
  dysponent_nazwa TEXT, dysponent_regon TEXT, zakres_json TEXT,
  dane_przykladowe INTEGER NOT NULL DEFAULT 0, nazwa_pliku TEXT, wczytano TEXT
);
CREATE TABLE IF NOT EXISTS mapping_profiles (source_id TEXT PRIMARY KEY REFERENCES sources(id), mapping_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS batches (
  id TEXT PRIMARY KEY, regon_dostawcy TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'wczytana' CHECK (status IN ('wczytana','zmapowana','przetworzona','zatwierdzona')),
  eksport_wygenerowano TEXT, utworzono TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS staged_records (
  batch_id TEXT NOT NULL REFERENCES batches(id), source_id TEXT NOT NULL, source_record_id TEXT,
  payload_json TEXT NOT NULL, issues_json TEXT
);
CREATE TABLE IF NOT EXISTS duplicate_candidates (
  batch_id TEXT NOT NULL REFERENCES batches(id), aed_a TEXT NOT NULL, aed_b TEXT NOT NULL,
  typ TEXT CHECK (typ IN ('w_partii','wzgledem_bazy')), pewnosc TEXT CHECK (pewnosc IN ('prawdopodobny','mozliwy')),
  odleglosc_m REAL, podobienstwo_adresu REAL,
  decyzja TEXT NOT NULL DEFAULT 'brak' CHECK (decyzja IN ('brak','scal','zostaw_oba'))
);
-- Oficjalne dane zatwierdzone przez dostawców. Zgłoszenia społeczności NIE trafiają tutaj.
CREATE TABLE IF NOT EXISTS aed (
  aed_id TEXT PRIMARY KEY, payload_json TEXT NOT NULL, lat REAL, lon REAL, regon_dostawcy TEXT,
  data_ostatniego_potwierdzenia TEXT, data_ostatniej_edycji TEXT,
  status TEXT NOT NULL DEFAULT 'zatwierdzony' CHECK (status IN ('zatwierdzony','wycofany'))
);
CREATE INDEX IF NOT EXISTS idx_aed_geo ON aed(lat, lon);
CREATE TABLE IF NOT EXISTS aed_sources (
  aed_id TEXT NOT NULL REFERENCES aed(aed_id), source_id TEXT NOT NULL, source_record_id TEXT,
  glowne INTEGER NOT NULL DEFAULT 0, data_importu TEXT, zakres_snapshot_json TEXT,
  licencja_snapshot TEXT, dysponent_snapshot TEXT
);
-- Tylko dopisywanie (repo.py nie zawiera UPDATE/DELETE dla tych dwóch tabel).
CREATE TABLE IF NOT EXISTS aed_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT, aed_id TEXT NOT NULL, kiedy TEXT NOT NULL,
  typ_zmiany TEXT NOT NULL CHECK (typ_zmiany IN ('utworzenie','import','edycja','potwierdzenie','scalenie','wycofanie')),
  autor TEXT NOT NULL, zmiany_json TEXT
);
CREATE TABLE IF NOT EXISTS declarations (
  id INTEGER PRIMARY KEY AUTOINCREMENT, regon TEXT NOT NULL,
  typ TEXT NOT NULL CHECK (typ IN ('prawdziwosc','prawo_do_udostepniania','aktualnosc')),
  batch_id TEXT, aed_id TEXT, wersja_tresci TEXT, tresc_hash TEXT, zakres_json TEXT, zaakceptowano TEXT NOT NULL
);
-- Warstwa oddolna, rozdzielona od aed.
CREATE TABLE IF NOT EXISTS field_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT, aed_id TEXT NOT NULL, typ TEXT NOT NULL, komentarz TEXT,
  utworzono TEXT NOT NULL, ip_hash TEXT
);
