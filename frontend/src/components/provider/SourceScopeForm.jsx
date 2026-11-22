import { isValidRegonFormat } from '../../lib/regon.js'
import { valueLabel } from '../../lib/labels.js'
import Field from '../common/Field.jsx'

export const emptySource = (filename = '') => ({
  nazwa: filename.replace(/\.[^.]+$/, ''), url: '', licencja: '', prawo_do_udostepniania: '', podstawa_prawa_opis: '',
  dysponent_nazwa: '', dysponent_regon: '', dane_przykladowe: false,
  zakres: { opis: '', obszar: '', teryt: '', typy_obiektow: '', stan_na: '', kompletnosc: '' },
})

/** Walidacja klientowa opisu źródła (reszta po stronie backendu: AED-SRC-001, AED-LIC-001). */
export function validateSource(v) {
  const e = {}
  if (!v.nazwa.trim()) e.nazwa = 'Podaj nazwę źródła.'
  if (!v.licencja) e.licencja = 'Wybierz licencję.'
  if (!v.prawo_do_udostepniania) e.prawo_do_udostepniania = 'Wskaż podstawę prawa do udostępniania.'
  if (!v.dysponent_nazwa.trim()) e.dysponent_nazwa = 'Podaj podmiot zarządzający danymi.'
  if (v.dysponent_regon && !isValidRegonFormat(v.dysponent_regon.replace(/\s|-/g, ''))) e.dysponent_regon = 'Numer REGON ma niepoprawny format.'
  if (!v.zakres.opis.trim()) e.zakres_opis = 'Opisz zakres referencyjny źródła.'
  return e
}

/** Wartość formularza -> obiekt `meta` wysyłany do POST /provider/batches. */
export function toMeta(v) {
  const list = (s) => s.split(',').map((x) => x.trim()).filter(Boolean)
  const z = v.zakres
  return {
    nazwa: v.nazwa.trim(), url: v.url.trim() || undefined, licencja: v.licencja, prawo_do_udostepniania: v.prawo_do_udostepniania,
    podstawa_prawa_opis: v.podstawa_prawa_opis.trim() || undefined, dysponent_nazwa: v.dysponent_nazwa.trim(),
    dysponent_regon: v.dysponent_regon.replace(/\s|-/g, '') || undefined, dane_przykladowe: v.dane_przykladowe,
    zakres_referencyjny: {
      opis: z.opis.trim(), obszar: { nazwa: z.obszar.trim() || undefined, teryt: list(z.teryt) },
      typy_obiektow: list(z.typy_obiektow), stan_na: z.stan_na || undefined, kompletnosc: z.kompletnosc || undefined,
    },
  }
}

export default function SourceScopeForm({ index, filename, value, onChange, errors = {}, schema }) {
  const id = (n) => `src${index}-${n}`
  const set = (patch) => onChange({ ...value, ...patch })
  const setZ = (patch) => onChange({ ...value, zakres: { ...value.zakres, ...patch } })
  const opts = (field) => (schema?.slowniki?.[field] || []).map((o) => <option key={o} value={o}>{valueLabel(field, o) === o ? o : `${valueLabel(field, o)}`}</option>)
  return (
    <fieldset>
      <legend>Źródło {index + 1}: {filename}</legend>
      <div className="grid2">
        <Field id={id('nazwa')} label="Nazwa źródła" required error={errors.nazwa} hint="Stała nazwa pozwala aktualizować te same rekordy przy ponownym imporcie.">
          <input type="text" value={value.nazwa} onChange={(e) => set({ nazwa: e.target.value })} />
        </Field>
        <Field id={id('url')} label="Adres źródła (URL)"><input type="url" value={value.url} onChange={(e) => set({ url: e.target.value })} /></Field>
        <Field id={id('licencja')} label="Licencja" required error={errors.licencja}>
          <select value={value.licencja} onChange={(e) => set({ licencja: e.target.value })}><option value="">— wybierz —</option>{opts('licencja')}</select>
        </Field>
        <Field id={id('prawo')} label="Podstawa prawa do udostępniania" required error={errors.prawo_do_udostepniania}
          hint="Wartość „nieustalone” blokuje zatwierdzenie danych.">
          <select value={value.prawo_do_udostepniania} onChange={(e) => set({ prawo_do_udostepniania: e.target.value })}>
            <option value="">— wybierz —</option>{opts('prawo_do_udostepniania')}</select>
        </Field>
        <Field id={id('podstawa')} label="Opis podstawy prawnej"><input type="text" value={value.podstawa_prawa_opis} onChange={(e) => set({ podstawa_prawa_opis: e.target.value })} /></Field>
        <Field id={id('dysp')} label="Podmiot zarządzający danymi (dysponent)" required error={errors.dysponent_nazwa}
          hint="Podmiot prowadzący dane źródłowe; może być tym samym co dostawca.">
          <input type="text" value={value.dysponent_nazwa} onChange={(e) => set({ dysponent_nazwa: e.target.value })} />
        </Field>
        <Field id={id('dysp-regon')} label="REGON dysponenta (opcjonalnie)" error={errors.dysponent_regon}>
          <input type="text" inputMode="numeric" value={value.dysponent_regon} onChange={(e) => set({ dysponent_regon: e.target.value })} />
        </Field>
      </div>
      <h3>Zakres referencyjny źródła</h3>
      <p className="small muted">Pozwala odbiorcy odróżnić „brak urządzenia” od „brak danych źródłowych”.</p>
      <Field id={id('z-opis')} label="Opis zakresu" required error={errors.zakres_opis}>
        <input type="text" value={value.zakres.opis} onChange={(e) => setZ({ opis: e.target.value })} />
      </Field>
      <div className="grid2">
        <Field id={id('z-obszar')} label="Obszar (nazwa)"><input type="text" value={value.zakres.obszar} onChange={(e) => setZ({ obszar: e.target.value })} /></Field>
        <Field id={id('z-teryt')} label="Kody TERYT (po przecinku)"><input type="text" value={value.zakres.teryt} onChange={(e) => setZ({ teryt: e.target.value })} /></Field>
        <Field id={id('z-typy')} label="Typy obiektów (po przecinku)"><input type="text" value={value.zakres.typy_obiektow} onChange={(e) => setZ({ typy_obiektow: e.target.value })} /></Field>
        <Field id={id('z-stan')} label="Stan na dzień"><input type="date" value={value.zakres.stan_na} onChange={(e) => setZ({ stan_na: e.target.value })} /></Field>
        <Field id={id('z-komp')} label="Kompletność">
          <select value={value.zakres.kompletnosc} onChange={(e) => setZ({ kompletnosc: e.target.value })}><option value="">— nie podano —</option>{opts('kompletnosc')}</select>
        </Field>
      </div>
      <div className="check"><input id={id('demo')} type="checkbox" checked={value.dane_przykladowe} onChange={(e) => set({ dane_przykladowe: e.target.checked })} />
        <label htmlFor={id('demo')}>To dane przykładowe / demonstracyjne (zostaną oznaczone w aplikacji i w eksporcie)</label></div>
    </fieldset>
  )
}
