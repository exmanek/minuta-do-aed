import { useRef, useState } from 'react'
import { createBatch } from '../../api/provider.js'
import { useSchema } from '../../auth/SchemaContext.jsx'
import ErrorSummary from '../common/ErrorSummary.jsx'
import SourceScopeForm, { emptySource, toMeta, validateSource } from './SourceScopeForm.jsx'

const ALLOWED = ['csv', 'json', 'xlsx']
export const extOf = (n) => (n.split('.').pop() || '').toLowerCase()

export default function UploadPanel({ onCreated }) {
  const { schema } = useSchema()
  const input = useRef(null)
  const [items, setItems] = useState([]) // [{file, meta}]
  const [rejected, setRejected] = useState([])
  const [errors, setErrors] = useState([])
  const [apiError, setApiError] = useState(null)
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)

  const add = (fileList) => {
    const ok = [], bad = []
    for (const f of fileList) (ALLOWED.includes(extOf(f.name)) ? ok : bad).push(f)
    setRejected(bad.map((f) => `${f.name}: ${extOf(f.name).toUpperCase() || 'ten typ'} nie jest dopuszczalnym formatem danych (dozwolone: CSV, JSON, XLSX).`))
    setItems((cur) => [...cur, ...ok.map((file) => ({ file, meta: emptySource(file.name) }))].slice(0, 10))
  }
  const submit = async (e) => {
    e.preventDefault()
    const errs = items.map((i) => validateSource(i.meta))
    setErrors(errs); setApiError(null)
    if (errs.some((x) => Object.keys(x).length)) return
    setBusy(true)
    try { onCreated(await createBatch(items.map((i) => i.file), items.map((i) => toMeta(i.meta)))) }
    catch (err) { setApiError(err) } finally { setBusy(false) }
  }
  return (
    <form onSubmit={submit} noValidate>
      <h2>Krok 1. Wgraj źródła danych</h2>
      <div className={`dropzone ${over ? 'over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); add([...e.dataTransfer.files]) }}>
        <p>Przeciągnij pliki tutaj albo</p>
        <button type="button" onClick={() => input.current.click()}>Wybierz pliki (CSV, JSON, XLSX)</button>
        <input ref={input} type="file" multiple accept=".csv,.json,.xlsx" className="sr-only" aria-label="Wybierz pliki danych"
          onChange={(e) => { add([...e.target.files]); e.target.value = '' }} />
        <p className="small muted">Od 1 do 10 plików, do 5 MB łącznie. Dane muszą być w formacie maszynowo odczytywalnym – PDF i DOC nie są akceptowane.</p>
      </div>
      {rejected.length > 0 && <div className="alert bad" role="alert"><ul>{rejected.map((r) => <li key={r}>{r}</li>)}</ul></div>}
      <ErrorSummary error={apiError} />
      {items.map((it, i) => (
        <div key={it.file.name + i}>
          <SourceScopeForm index={i} filename={it.file.name} value={it.meta} errors={errors[i] || {}} schema={schema}
            onChange={(m) => setItems((cur) => cur.map((x, j) => (j === i ? { ...x, meta: m } : x)))} />
          <button type="button" className="danger" onClick={() => setItems((cur) => cur.filter((_, j) => j !== i))}>Usuń plik {it.file.name}</button>
        </div>
      ))}
      {items.length > 0 && <div className="btn-row"><button type="submit" className="primary" disabled={busy}>{busy ? 'Wczytywanie…' : 'Wczytaj i zaproponuj mapowanie'}</button></div>}
    </form>
  )
}
