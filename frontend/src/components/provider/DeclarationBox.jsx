import { useEffect } from 'react'
import { getDeclarations } from '../../api/standard.js'
import { useApi } from '../../hooks/useApi.js'
import { LoadError, Loading } from '../common/Feedback.jsx'

export const emptyDeclarations = () => ({ prawdziwosc: false, prawo_do_udostepniania: false, aktualnosc: false })
export const declarationsComplete = (v) => v.prawdziwosc && v.prawo_do_udostepniania

/** Trzy osobne oświadczenia: dwa wymagane + opcjonalne potwierdzenie aktualności. Backend sprawdza je ponownie. */
export default function DeclarationBox({ value, onChange, onVersion, children }) {
  const { data, loading, error, reload } = useApi(getDeclarations, [])
  useEffect(() => { if (data) onVersion?.(data.wersja) }, [data]) // eslint-disable-line react-hooks/exhaustive-deps
  if (loading) return <Loading />
  if (error) return <LoadError error={error} onRetry={reload} />
  const set = (k, v) => onChange({ ...value, [k]: v })
  return (
    <fieldset>
      <legend>Oświadczenia dostawcy (wersja treści {data.wersja})</legend>
      {data.robocza && <p className="alert warn small">Treść robocza – wymaga zatwierdzenia prawnego przed użyciem produkcyjnym.</p>}
      {data.oswiadczenia.map((o) => (
        <div className="check" key={o.typ}>
          <input id={`decl-${o.typ}`} type="checkbox" checked={value[o.typ]} onChange={(e) => set(o.typ, e.target.checked)} />
          <label htmlFor={`decl-${o.typ}`}>{o.tresc} <span className="muted small">{o.wymagane ? '(wymagane)' : '(opcjonalne – ustawia datę ostatniego potwierdzenia)'}</span></label>
        </div>
      ))}
      {children}
    </fieldset>
  )
}
