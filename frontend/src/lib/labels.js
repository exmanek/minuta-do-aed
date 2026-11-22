// Etykiety wartości słowników. Nazwy pól i opisy pochodzą z /meta/schema (XLSX); tutaj tylko teksty wartości.
export const VALUE_LABELS = {
  dostepnosc: { calodobowo: 'Całodobowo', w_godzinach: 'W określonych godzinach', nieznana: 'Nieznana (brak danych)' },
  bariera_dostepu: { brak: 'Brak bariery', kod: 'Kod', klucz: 'Klucz', karta: 'Karta', obsluga: 'Przez obsługę', nieznana: 'Nieznana (brak danych)' },
  ograniczenia_dostepu: { publiczny: 'Publiczny', klienci: 'Tylko klienci', personel: 'Tylko personel', strefa_zastrzezona: 'Strefa zastrzeżona', nieznane: 'Nieznane (brak danych)' },
  stan: { sprawny: 'Sprawny', gotowy_do_uzycia: 'Gotowy do użycia', czasowo_niedostepny: 'Czasowo niedostępny', nieznany: 'Nieznany (brak danych)' },
  licencja: {}, kompletnosc: { pelna: 'Pełna', czesciowa: 'Częściowa', nieznana: 'Nieznana' },
  prawo_do_udostepniania: { dane_wlasne: 'Dane własne', zgoda_dysponenta: 'Zgoda dysponenta', licencja_zrodla_pozwala: 'Licencja źródła pozwala', nieustalone: 'Nieustalone (blokuje zatwierdzenie)' },
}
export const valueLabel = (field, value) => (value == null || value === '' ? '—' : VALUE_LABELS[field]?.[value] ?? String(value))

export const STATUS = {
  dostepny: { cls: 'ok', icon: '✔', text: 'Dostępny', help: 'Wszystkie cztery aspekty są znane i bez przeszkód.' },
  ograniczony_dostep: { cls: 'warn', icon: '!', text: 'Ograniczony dostęp', help: 'Do urządzenia można dotrzeć, ale jest bariera lub ograniczenie.' },
  niedostepny: { cls: 'bad', icon: '✖', text: 'Niedostępny', help: 'Urządzenie jest teraz niedostępne.' },
  nieznany: { cls: 'unk', icon: '?', text: 'Brak danych o dostępności', help: 'Brak informacji — to nie oznacza, że urządzenie jest niedostępne.' },
}
export const FRESHNESS = {
  aktualne: { cls: 'ok', text: 'Aktualne' },
  do_odswiezenia: { cls: 'warn', text: 'Do odświeżenia (potwierdzenie starsze niż 12 mies.)' },
  niepotwierdzone: { cls: 'unk', text: 'Niepotwierdzone (brak daty potwierdzenia)' },
}
export const REPORT_TYPES = {
  zamkniete_na_klucz: 'Zamknięte na klucz', potwierdzam_obecnosc: 'Potwierdzam obecność urządzenia',
  brak_urzadzenia: 'Nie ma urządzenia', uszkodzone: 'Urządzenie uszkodzone',
}
export const LEVEL = { blad: { cls: 'bad', text: 'Błąd' }, ostrzezenie: { cls: 'warn', text: 'Ostrzeżenie' } }
