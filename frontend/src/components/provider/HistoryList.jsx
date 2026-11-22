import { aedHistory } from '../../api/provider.js'
import { useApi } from '../../hooks/useApi.js'
import { formatDate } from '../../lib/format.js'
import { LoadError, Loading } from '../common/Feedback.jsx'

const TYPES = { utworzenie: 'Utworzenie', import: 'Import', edycja: 'Edycja', potwierdzenie: 'Potwierdzenie aktualności', scalenie: 'Scalenie', wycofanie: 'Wycofanie' }

export default function HistoryList({ aedId }) {
  const { data, loading, error, reload } = useApi(() => aedHistory(aedId), [aedId])
  if (loading) return <Loading />
  if (error) return <LoadError error={error} onRetry={reload} />
  return (
    <div>
      <h4>Historia zmian (tylko odczyt)</h4>
      <ul>{data.historia.map((h) => (
        <li key={h.id}>{formatDate(h.kiedy)} · <strong>{TYPES[h.typ_zmiany] || h.typ_zmiany}</strong> · autor: {h.autor}
          {h.zmiany?.pola && Object.keys(h.zmiany.pola).length > 0 && <> · zmienione pola: {Object.keys(h.zmiany.pola).join(', ')}</>}</li>))}</ul>
      <h4>Deklaracje</h4>
      {data.deklaracje.length === 0 ? <p className="muted">Brak.</p> :
        <ul>{data.deklaracje.map((d) => <li key={d.id}>{formatDate(d.zaakceptowano)} · {d.typ} · wersja {d.wersja_tresci}</li>)}</ul>}
    </div>
  )
}
