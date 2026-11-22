import { useEffect, useRef } from 'react'
import { errorLines, errorMessage } from '../../lib/errors.js'

/** Podsumowanie błędu API (aria-live, fokus po pojawieniu). `fieldIds` = mapa pole -> id kontrolki do linkowania. */
export default function ErrorSummary({ error, title, fieldIds = {} }) {
  const ref = useRef(null)
  useEffect(() => { if (error && ref.current) ref.current.focus() }, [error])
  if (!error) return null
  const details = (error.details || []).filter((d) => d && (d.komunikat || d.message || typeof d === 'string'))
  return (
    <div className="alert bad" role="alert" tabIndex={-1} ref={ref}>
      <strong>{title || errorMessage(error)}</strong>
      {error.code && <span className="small"> (kod: {error.code})</span>}
      {details.length > 0 && (
        <ul>
          {details.slice(0, 50).map((d, i) => {
            const line = errorLines({ details: [d] })[0]
            const target = d.pole && fieldIds[d.pole]
            return <li key={i}>{target ? <a href={`#${target}`}>{line}</a> : line}{d.regula && <span className="small muted"> [{d.regula}]</span>}</li>
          })}
          {details.length > 50 && <li>… i {details.length - 50} kolejnych</li>}
        </ul>
      )}
    </div>
  )
}
