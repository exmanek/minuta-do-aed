# Minuta do AED

Prototyp do zadania **„Misja AED – Dane na ratunek”** (HackNation 2026). Hasło akcji: nie ustalone.

**Problem.** W nagłej sytuacji nie wiadomo, gdzie jest działający defibrylator, a dane o AED są rozproszone i nieujednolicone.
**Rozwiązanie.** Dostawca danych (podmiot z REGON) wczytuje źródła (CSV, JSON, XLSX lub wprost z dane.gov.pl) → mapowanie → walidacja (18 reguł) → duplikaty (bez automatycznego scalania) → oświadczenia → zatwierdzenie. Wynik: **mapa AED dla obywatela** i **eksport CSV / JSON / GeoJSON z metryczką** gotowy do publikacji w dane.gov.pl.

## Uruchom (Python 3.11+, Node 18+)
```bash
git clone https://github.com/exmanek/minuta-do-aed.git && cd minuta-do-aed && ./start.sh
```
Otwórz **http://localhost:5173**. Konto dostawcy: REGON `123456785`, hasło `demo-haslo-1`. Na starcie jest 15 fikcyjnych punktów; prawdziwe z dane.gov.pl: *Import → „Z portalu dane.gov.pl”*.

## Sprawdź w 2 minuty
1. **Mapa:** skupiska z liczbą AED (kolor = przeważający rodzaj) → kliknij pinezkę → kafelek z „gdzie dokładnie” i czterema aspektami dostępności.
2. **Menu „Dostępność”** (powiększenie tekstu, wysoki kontrast) i deklaracja dostępności.
3. **Zaloguj się → Import:** wgraj plik z `backend/data/sample_sources/` → mapowanie → raport → zatwierdź → punkt na mapie → eksport.
4. **Standard danych:** pobierz wzorzec XLSX.

## Najważniejsze
- **Wzorzec XLSX** (24 pola) jest jedynym źródłem prawdy dla backendu, formularzy i testów: `backend/data/standard/`.
- Dostępność w **czterech aspektach**, **trzy daty** aktualności; brak informacji = „nieznany”, nigdy „niedostępny”.
- Zgłoszenia z terenu **nie zmieniają** danych oficjalnych. Zatwierdzenie i eksport **nie są** publikacją w dane.gov.pl.
- Testy: backend **75** (`cd backend && pytest`), frontend **55** (`cd frontend && npm test`). WCAG 2.1 AA: częściowo zgodna, kontrast 52/52 par.

## Ograniczenia
Weryfikacja dostawcy jest symulowana (REGON tylko składniowo) · brak geokodowania adresów i publikacji do portalu · metryczka XML bez walidacji XSD · dane z portalu bez dostępności i stanu · brak audytu dostępności i testów E2E · oświadczenia robocze · nie zastępuje numeru **112**.

## AI
Asystent AI (Claude / Claude Code) pomagał w analizie, pisaniu kodu, testów i dokumentacji. Założenia, decyzje projektowe, przegląd i testy: zespół. `[UZUPEŁNIJ: AI poza kodem, autorzy]`

## Licencja
Kod: **MIT** ([LICENSE](LICENSE)). Prawa majątkowe do rozwiązania przenosi zwycięski zespół na Ministra Cyfryzacji odrębną umową (§ 4 regulaminu).

Więcej: [pełna dokumentacja](docs/dokumentacja.md) · [kontrakt API](docs/api-contract.md) · [decyzje](docs/decisions.md)
