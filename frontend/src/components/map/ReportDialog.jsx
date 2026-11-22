import { useState } from 'react'
import { postReport } from '../../api/aed.js'
import { REPORT_TYPES } from '../../lib/labels.js'
import ErrorSummary from '../common/ErrorSummary.jsx'
import Field from '../common/Field.jsx'
import Dialog from '../common/Dialog.jsx'

/** Zgłoszenie z terenu. Trafia do osobnej warstwy społeczności i NIE zmienia oficjalnego rekordu. */
export default function ReportDialog({ aedId, onClose, onSent }) {
  const [typ, setTyp] = useState('')
  const [komentarz, setKomentarz] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    if (!typ) return setError({ message: 'Wybierz rodzaj zgłoszenia.', details: [] })
    setBusy(true); setError(null)
    try { await postReport(aedId, typ, komentarz.trim()); setDone(true); onSent?.() }
    catch (err) { setError(err.status === 429 ? { ...err, message: 'Zbyt wiele zgłoszeń z tego adresu. Spróbuj później.' } : err) }
    finally { setBusy(false) }
  }
  return (
    <Dialog title="Zgłoś problem z punktem" onClose={onClose}>
      {done ? (
        <>
          <p className="alert ok" role="status">Dziękujemy. Zgłoszenie zapisano jako uwagę społeczności.</p>
          <p className="small muted">Nie zmienia ono oficjalnych danych dostawcy ani statusu dostępności.</p>
          <button type="button" className="primary" onClick={onClose}>Zamknij</button>
        </>
      ) : (
        <form onSubmit={submit} noValidate>
          <ErrorSummary error={error} />
          <Field id="rep-typ" label="Rodzaj zgłoszenia" required>
            <select value={typ} onChange={(e) => setTyp(e.target.value)}>
              <option value="">— wybierz —</option>
              {Object.entries(REPORT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field id="rep-kom" label="Komentarz (opcjonalnie)" hint={`${komentarz.length}/300 znaków`}>
            <textarea maxLength={300} value={komentarz} onChange={(e) => setKomentarz(e.target.value)} />
          </Field>
          <p className="small muted">Zgłoszenie trafia do osobnej warstwy uwag społeczności i nie zmienia oficjalnego rekordu.</p>
          <div className="btn-row">
            <button type="submit" className="primary" disabled={busy}>{busy ? 'Wysyłanie…' : 'Wyślij zgłoszenie'}</button>
            <button type="button" onClick={onClose}>Anuluj</button>
          </div>
        </form>
      )}
    </Dialog>
  )
}
