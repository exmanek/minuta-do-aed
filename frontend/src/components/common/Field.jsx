import { Children, cloneElement, isValidElement } from 'react'

/** Etykieta + opis + błąd/ostrzeżenie powiązane z kontrolką (aria-describedby, aria-invalid). */
export default function Field({ id, label, hint, error, warning, required, children }) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-err`, warning && `${id}-warn`].filter(Boolean).join(' ') || undefined
  const control = Children.map(children, (c) =>
    isValidElement(c) ? cloneElement(c, { id, 'aria-invalid': error ? 'true' : undefined, 'aria-describedby': describedBy, required: required || undefined }) : c)
  return (
    <div className="field" data-field={id}>
      <label htmlFor={id}>{label}{required && <span aria-hidden="true"> *</span>}{required && <span className="sr-only"> (wymagane)</span>}</label>
      {hint && <p className="hint" id={`${id}-hint`}>{hint}</p>}
      {control}
      {error && <p className="err" id={`${id}-err`} role="alert">{error}</p>}
      {warning && !error && <p className="warn" id={`${id}-warn`}>{warning}</p>}
    </div>
  )
}
