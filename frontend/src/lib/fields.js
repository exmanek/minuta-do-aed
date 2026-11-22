// Grupowanie pól formularza AED. Nazwy, etykiety, statusy, typy i słowniki pochodzą z /meta/schema (XLSX);
// tutaj tylko kolejność sekcji. Pola spoza grup trafiają do sekcji „Pozostałe” (odporność na zmiany wzorca).
export const GROUPS = [
  { id: 'lok', title: 'Lokalizacja', fields: ['lat', 'lon', 'adres', 'kod_pocztowy', 'miasto', 'lokalizacja_w_obiekcie'] },
  { id: 'dost', title: 'Dostępność (cztery osobne aspekty)', fields: ['dostepnosc', 'godziny_dostepu', 'bariera_dostepu', 'ograniczenia_dostepu', 'ograniczenia_opis'] },
  { id: 'stan', title: 'Stan urządzenia i przegląd', fields: ['stan', 'data_ostatniego_przegladu'] },
  { id: 'zrodlo', title: 'Źródło i podmiot zarządzający danymi', fields: ['dysponent_nazwa', 'dysponent_regon', 'zrodlo_danych', 'zakres_referencyjny'] },
]
// pola ustawiane przez system/konto lub obsługiwane osobno (checkbox potwierdzenia, oświadczenia)
export const HIDDEN = new Set(['aed_id', 'nazwa_dostawcy', 'regon_dostawcy', 'oswiadczenie_prawdziwosci', 'data_ostatniego_potwierdzenia'])

export function formFields(schema) {
  const byName = Object.fromEntries(schema.pola.filter((p) => p.status !== 'wyliczane' && !HIDDEN.has(p.nazwa)).map((p) => [p.nazwa, p]))
  const used = new Set()
  const groups = GROUPS.map((g) => ({ ...g, items: g.fields.filter((f) => byName[f]).map((f) => (used.add(f), byName[f])) })).filter((g) => g.items.length)
  const rest = Object.values(byName).filter((p) => !used.has(p.nazwa))
  if (rest.length) groups.push({ id: 'inne', title: 'Pozostałe', items: rest })
  return groups
}

export const isRequired = (field, values) =>
  field.status === 'wymagane' || (field.status === 'warunkowo_wymagane' && field.nazwa === 'godziny_dostepu' && values.dostepnosc === 'w_godzinach')
