export const schema = {
  wersja: 'xlsx',
  pola: [
    { nazwa: 'aed_id', status: 'wymagane', typ: 'tekst', etykieta: 'Identyfikator AED', opis: '', przyklad: '' },
    { nazwa: 'lat', status: 'wymagane', typ: 'liczba', etykieta: 'Szerokość geograficzna', opis: 'WGS84', przyklad: '52.2' },
    { nazwa: 'lon', status: 'wymagane', typ: 'liczba', etykieta: 'Długość geograficzna', opis: 'WGS84', przyklad: '21.0' },
    { nazwa: 'adres', status: 'wymagane', typ: 'tekst', etykieta: 'Adres', opis: '', przyklad: '' },
    { nazwa: 'dostepnosc', status: 'wymagane', typ: 'slownik', etykieta: 'Godziny dostępności', opis: '', przyklad: '' },
    { nazwa: 'godziny_dostepu', status: 'warunkowo_wymagane', typ: 'tekst', etykieta: 'Godziny dostępu', opis: '', przyklad: '' },
    { nazwa: 'stan', status: 'wymagane', typ: 'slownik', etykieta: 'Stan urządzenia', opis: '', przyklad: '' },
    { nazwa: 'nazwa_dostawcy', status: 'wymagane', typ: 'tekst', etykieta: 'Dostawca', opis: '', przyklad: '' },
    { nazwa: 'data_ostatniego_potwierdzenia', status: 'opcjonalne', typ: 'data', etykieta: 'Potwierdzenie', opis: '', przyklad: '' },
    { nazwa: 'data_importu', status: 'wyliczane', typ: 'data', etykieta: 'Data importu', opis: '', przyklad: '' },
    { nazwa: 'nowe_pole_z_xlsx', status: 'opcjonalne', typ: 'tekst', etykieta: 'Nowe pole z wzorca', opis: '', przyklad: '' },
  ],
  zrodlo_pola: [], pola_wyliczane: [],
  slowniki: { dostepnosc: ['calodobowo', 'w_godzinach', 'nieznana'], stan: ['sprawny', 'nieznany'] },
}
