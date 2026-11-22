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

// Ton pigułki dla wartości czterech aspektów dostępności. „Brak danych” jest neutralny (unk), nigdy alarmujący.
export const ASPECT_TONE = {
  dostepnosc: { calodobowo: 'ok', w_godzinach: 'info', nieznana: 'unk' },
  bariera_dostepu: { brak: 'ok', kod: 'warn', klucz: 'warn', karta: 'warn', obsluga: 'warn', nieznana: 'unk' },
  ograniczenia_dostepu: { publiczny: 'ok', klienci: 'warn', personel: 'warn', strefa_zastrzezona: 'warn', nieznane: 'unk' },
  stan: { sprawny: 'ok', gotowy_do_uzycia: 'ok', czasowo_niedostepny: 'bad', nieznany: 'unk' },
}
export const aspectTone = (field, value) => ASPECT_TONE[field]?.[value] || 'unk'

// Kolor i symbol pinezki na mapie. Status (wartość) pochodzi z backendu; frontend tylko dobiera wygląd.
// zielony = działa, żółty = działa w określonych godzinach / z ograniczeniem dostępu, czerwony = nie działa, „?” = brak danych.
export const PIN_TONES = {
  ok: { cls: 'ok', icon: '✔', text: 'Działa' },
  hours: { cls: 'hours', icon: '!', text: 'Działa w określonych godzinach lub z ograniczeniem dostępu' },
  bad: { cls: 'bad', icon: '✖', text: 'Nie działa' },
  unk: { cls: 'unk', icon: '?', text: 'Brak danych' },
}
export function pinTone(item) {
  const v = item?.status_dostepnosci?.wartosc
  if (v === 'niedostepny') return PIN_TONES.bad
  if (v === 'dostepny') return item.dostepnosc === 'w_godzinach' ? PIN_TONES.hours : PIN_TONES.ok
  if (v === 'ograniczony_dostep') return PIN_TONES.hours
  return PIN_TONES.unk
}
