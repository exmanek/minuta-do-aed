# Decyzje otwarte (D1–D12) – wartości obowiązujące do czasu odpowiedzi

Źródło: dokumentacja v2, załącznik B. Do czasu potwierdzenia przyjmujemy wartości domyślne.

| # | Kwestia | Obowiązuje | Do potwierdzenia przez |
|---|---|---|---|
| D1 | Uwierzytelnianie dostawcy | konta demo z hasłem, status nadaje seed; REGON tylko składnia | Mentor |
| D2 | Dostawca publikuje dane innych dysponentów | `dysponent_nazwa` wymagane, `dysponent_regon` opcjonalne | Mentor |
| D3 | Scalanie z cudzym rekordem | zablokowane (422 `MERGE_FOREIGN_RECORD`) | Zespół, mentor |
| D4 | Filtr „potwierdzone przez REGON” | zastąpiony `tylko_aktualne` i `status_dostepnosci` | Zespół |
| D5 | `dostepnosc_teraz` | pomija tylko `niedostepny`; `nieznany` zostaje | Zespół |
| D6 | Data potwierdzenia przy zatwierdzeniu | tylko przy `potwierdzam_aktualnosc: true` | Zespół, mentor |
| D7 | Próg aktualności | 365 dni, konfigurowalny (`PROG_AKTUALNOSCI_DNI`) | Zespół |
| D8 | Śledzenie publikacji w dane.gov.pl | brak statusu publikacji | Zespół |
| D9 | Licencja zbioru zbiorczego, kategoria, GeoJSON, separator CSV | licencja przy źródle; separator `;`; reszta otwarta | Mentor / stoisko danych |
| D10 | `prawo_do_udostepniania = nieustalone` | blokuje zatwierdzenie (AED-LIC-001); treść oświadczeń robocza | Mentor, prawnik |
| D11 | `data_aktualizacji` | zastąpiona trzema datami (potwierdzenie, edycja, import) | Zespół |
| D12 | Moderacja zgłoszeń oddolnych | brak moderacji, limit 5/h na IP | Zespół |

Wzorzec XLSX v0.2 dodaje względem pierwotnego zamysłu pole `lokalizacja_w_obiekcie` („gdzie dokładnie jest urządzenie”),
bo `dostepnosc` w v2 oznacza godziny dostępności.
