import { useEffect, useMemo, useState } from 'react'
import { createAed, updateAed, validateAed } from '../../api/provider.js'
import { useSchema } from '../../auth/SchemaContext.jsx'
import { useDebounce } from '../../hooks/useDebounce.js'
import { fieldErrors } from '../../lib/errors.js'
import { formFields, isRequired } from '../../lib/fields.js'
import { valueLabel } from '../../lib/labels.js'
import ErrorSummary from '../common/ErrorSummary.jsx'
import Field from '../common/Field.jsx'
import { LoadError, Loading } from '../common/Feedback.jsx'
import CoordPicker from './CoordPicker.jsx'
import DeclarationBox, { declarationsComplete, emptyDeclarations } from './DeclarationBox.jsx'

const fid = (n) => `f-${n}`
export const initialValues = (groups, rec) => Object.fromEntries(groups.flatMap((g) => g.items).map((p) => [p.nazwa, rec?.[p.nazwa] ?? '']))

/** Zamienia wartości formularza na treść żądania (puste -> pominięte). */
export const toPayload = (values) => Object.fromEntries(Object.entries(values).filter(([, v]) => v !== '' && v !== null))

function Control({ p, value, onChange, values, ...aria }) { // aria = id, aria-invalid, aria-describedby, required z <Field>
  const required = isRequired(p, values)
  if (p.typ === 'slownik') {
    return (
      <select {...aria} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{required ? '— wybierz —' : '— nie podano —'}</option>
        {(values.__dict?.[p.nazwa] || []).map((o) => <option key={o} value={o}>{valueLabel(p.nazwa, o)}</option>)}
      </select>)
  }
  if (p.typ === 'data') return <input {...aria} type="date" value={value} onChange={(e) => onChange(e.target.value)} />
  if (p.typ === 'liczba') return <input {...aria} type="text" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
  if (p.nazwa === 'ograniczenia_opis' || p.nazwa === 'zakres_referencyjny') return <textarea {...aria} value={value} onChange={(e) => onChange(e.target.value)} />
  return <input {...aria} type="text" value={value} onChange={(e) => onChange(e.target.value)} />
}

/** Formularz punktu AED GENEROWANY z /meta/schema (kolejność, etykiety, statusy, typy, słowniki z XLSX). */
export default function AedForm({ existing, onSaved }) {
  const { schema, loading, error, reload } = useSchema()
  const groups = useMemo(() => (schema ? formFields(schema) : []), [schema])
  const [values, setValues] = useState(null)
  const [decl, setDecl] = useState(emptyDeclarations())
  const [version, setVersion] = useState('v1')
  const [potwierdzam, setPotwierdzam] = useState(false)
  const [issues, setIssues] = useState([])
  const [apiError, setApiError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(null)

  useEffect(() => { if (schema) setValues(initialValues(groups, existing)) }, [schema, existing]) // eslint-disable-line react-hooks/exhaustive-deps
  const debounced = useDebounce(values, 400)
  useEffect(() => { // walidacja na żywo: te same reguły co przy imporcie, bez zapisu
    if (!debounced || !Object.values(debounced).some((v) => v !== '')) return setIssues([])
    let cancelled = false
    validateAed({ ...toPayload(debounced), ...(existing ? { aed_id: existing.aed_id } : {}) })
      .then((r) => !cancelled && setIssues(r.problemy)).catch(() => {})
    return () => { cancelled = true }
  }, [debounced, existing])

  if (loading || !values) return <Loading />
  if (error) return <LoadError error={error} onRetry={reload} />
  const dict = schema.slowniki
  const vals = { ...values, __dict: dict }
  const live = {}
  for (const i of issues) if (i.pole && (!live[i.pole] || i.poziom === 'blad')) live[i.pole] = i
  const apiFieldErrs = fieldErrors(apiError)
  const set = (name, v) => { setValues((cur) => ({ ...cur, [name]: v })); setSaved(null) }

  const submit = async (e) => {
    e.preventDefault()
    setApiError(null); setSaved(null); setBusy(true)
    const body = { ...toPayload(values), oswiadczenie_prawdziwosci: decl.prawdziwosc, oswiadczenie_prawa_do_udostepniania: decl.prawo_do_udostepniania,
      potwierdzam_aktualnosc: potwierdzam, wersja_tresci: version }
    try {
      const rec = existing ? await updateAed(existing.aed_id, body) : await createAed(body)
      setSaved(rec); onSaved?.(rec)
      if (!existing) { setValues(initialValues(groups)); setDecl(emptyDeclarations()); setPotwierdzam(false); setIssues([]) }
    } catch (err) { setApiError(err) } finally { setBusy(false) }
  }
  const fieldIds = Object.fromEntries(groups.flatMap((g) => g.items).map((p) => [p.nazwa, fid(p.nazwa)]))
  const hasBlocking = issues.some((i) => i.poziom === 'blad')

  return (
    <form onSubmit={submit} noValidate aria-label={existing ? 'Edycja punktu AED' : 'Nowy punkt AED'}>
      <ErrorSummary error={apiError} fieldIds={fieldIds} />
      {saved && <p className="alert ok" role="status">Zapisano punkt <strong>{saved.aed_id}</strong>. Status dostępności: {saved.status_dostepnosci?.wartosc}; aktualność: {saved.znacznik_aktualnosci}.</p>}
      {groups.map((g) => (
        <fieldset key={g.id}>
          <legend>{g.title}</legend>
          {g.id === 'dost' && <p className="small muted">Brak informacji zaznacz jako „nieznana/nieznane” – nie oznacza to, że punkt jest niedostępny.</p>}
          {g.id === 'lok' && <CoordPicker lat={values.lat ?? ''} lon={values.lon ?? ''} onPick={(la, lo) => setValues((c) => ({ ...c, lat: String(la), lon: String(lo) }))} />}
          <div className="grid2">
            {g.items.map((p) => {
              const l = live[p.nazwa]
              const disabled = p.nazwa === 'godziny_dostepu' && values.dostepnosc !== 'w_godzinach'
              return (
                <Field key={p.nazwa} id={fid(p.nazwa)} label={p.etykieta} required={isRequired(p, values)}
                  hint={p.nazwa === 'godziny_dostepu' ? 'Składnia opening_hours, np. Mo-Fr 08:00-18:00 lub 24/7. Aktywne dla „W określonych godzinach”.' : p.opis}
                  error={apiFieldErrs[p.nazwa] || (l?.poziom === 'blad' ? l.komunikat : null)} warning={l?.poziom === 'ostrzezenie' ? l.komunikat : null}>
                  {disabled
                    ? <input type="text" value="" disabled placeholder="Nie dotyczy" />
                    : <Control p={p} value={values[p.nazwa]} onChange={(v) => set(p.nazwa, v)} values={vals} />}
                </Field>)
            })}
          </div>
        </fieldset>
      ))}
      <fieldset>
        <legend>Aktualność</legend>
        <p className="small muted">Data ostatniego potwierdzenia zmienia się wyłącznie po Twoim jawnym potwierdzeniu poniżej – sama edycja jej nie zmienia.{existing?.data_ostatniego_potwierdzenia && ` Obecnie: ${existing.data_ostatniego_potwierdzenia}.`}</p>
        <div className="check"><input id="f-potw" type="checkbox" checked={potwierdzam} onChange={(e) => setPotwierdzam(e.target.checked)} />
          <label htmlFor="f-potw">Potwierdzam, że dane tego punktu są aktualne na dziś</label></div>
      </fieldset>
      <DeclarationBox value={decl} onChange={setDecl} onVersion={setVersion} />
      {hasBlocking && <p className="alert bad" role="status">Formularz zawiera błędy blokujące zapis – popraw zaznaczone pola.</p>}
      <div className="btn-row">
        <button type="submit" className="primary" disabled={busy || !declarationsComplete(decl)}>{busy ? 'Zapisywanie…' : existing ? 'Zapisz zmiany' : 'Dodaj punkt'}</button>
        {!declarationsComplete(decl) && <span className="small muted" role="note">Zaznacz oba wymagane oświadczenia, aby zapisać.</span>}
      </div>
    </form>
  )
}
