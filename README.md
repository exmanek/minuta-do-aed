# Minuta do AED

Prototyp do zadania **„Misja AED – Dane na ratunek”** (HackNation 2026). Hasło akcji: nie ustalone.

**Problem.** W nagłej sytuacji nie wiadomo, gdzie jest działający defibrylator, a dane o AED są rozproszone i nieujednolicone.
**Rozwiązanie.** Narzędzie dla dostawcy danych (podmiot z REGON), które **zasila dane.gov.pl jednolitą tabelą AED**: wczytuje źródła (CSV, JSON, XLSX lub wprost z dane.gov.pl) → mapowanie → walidacja (18 reguł) → duplikaty (bez automatycznego scalania) → oświadczenia → zatwierdzenie. Wynik to:

- **Wykaz AED** – zasób tabelaryczny w zakresie kolumn wzorca danych, gotowy do publikacji w portalu: **CSV + metryczka zbioru (XML/JSON)**,
- **mapa AED** dla obywatela – przykład wykorzystania tych danych.

## Uruchom (Python 3.11+, Node 18+)
```bash
git clone https://github.com/exmanek/minuta-do-aed.git && cd minuta-do-aed && ./start.sh
```
Otwórz **http://localhost:5173**. Konto dostawcy: REGON `123456785`, hasło `demo-haslo-1`. Na starcie jest 15 fikcyjnych punktów; prawdziwe z dane.gov.pl: *Import → „Z portalu dane.gov.pl”*.

## Sprawdź w 2 minuty
1. **Wykaz AED** → tabela zasobu (sortowanie, wyszukiwanie) → **Pobierz CSV** i metryczkę zbioru.
2. **Mapa:** skupiska z liczbą AED → kliknij pinezkę → „gdzie dokładnie” i cztery aspekty dostępności.
3. **Zaloguj się → Import:** plik z `backend/data/sample_sources/` → mapowanie → raport → zatwierdź → punkt w wykazie i na mapie.
4. **Menu „Dostępność”** (powiększenie tekstu, wysoki kontrast) i deklaracja dostępności.

## Najważniejsze
- **Wzorzec XLSX** (24 pola) jest jedynym źródłem prawdy dla backendu, formularzy i testów: `backend/data/standard/`. Zakres kolumn wykazu to jego podzbiór, zdefiniowany w jednym miejscu (`WYKAZ_FIELDS`).
- Dostępność w **czterech aspektach**, **trzy daty** aktualności; brak informacji = „nieznany”, nigdy „niedostępny”.
- Zgłoszenia z terenu **nie zmieniają** danych oficjalnych.
- Testy: backend **76** (`cd backend && pytest`), frontend **58** (`cd frontend && npm test`). WCAG 2.1 AA: częściowo zgodna, kontrast 52/52 par.

## Ograniczenia
**Prototyp nie publikuje w dane.gov.pl** – CSV i metryczkę trzeba zaimportować w portalu; import w lokalnej instancji portalu nie jest jeszcze potwierdzony, a metryczka XML nie przeszła walidacji XSD · weryfikacja dostawcy symulowana (REGON tylko składniowo) · brak geokodowania adresów · dane z portalu bez dostępności i stanu · brak audytu dostępności i testów E2E · oświadczenia robocze · nie zastępuje numeru **112**.

## AI
Asystent AI (Claude / Claude Code) pomagał w analizie, pisaniu kodu, testów i dokumentacji. Założenia, decyzje projektowe, przegląd i testy: zespół. `[UZUPEŁNIJ: AI poza kodem, autorzy]`

## Licencja
Kod: **MIT** ([LICENSE](LICENSE)). Prawa majątkowe do rozwiązania przenosi zwycięski zespół na Ministra Cyfryzacji odrębną umową (§ 4 regulaminu).

Więcej: [pełna dokumentacja](docs/dokumentacja.md) · [księga znaku](docs/ksiega-znaku/ksiega-znaku-minuta-do-aed.pdf) · [kontrakt API](docs/api-contract.md) · [decyzje](docs/decisions.md)
