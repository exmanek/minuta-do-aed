import { useState } from 'react'
import { downloadReportCsv, getReport } from '../../api/provider.js'
import { useApi } from '../../hooks/useApi.js'
import { LEVEL } from '../../lib/labels.js'
import ErrorSummary from '../common/ErrorSummary.jsx'
import { LoadError, Loading } from '../common/Feedback.jsx'

export function SummaryTiles({ s }) {
  const t = [['Rekordy', s.rekordy], ['Bez błędów', s.bez_bledow], ['Z ostrzeżeniami', s.z_ostrzezeniami], ['Z błędami blokującymi', s.z_bledami],
    ['Duplikaty w partii', s.kandydaci_duplikatow.w_partii], ['Duplikaty względem bazy', s.kandydaci_duplikatow.wzgledem_bazy],
    ['Aktualizacje istniejących', s.zaktualizowane_istniejace], ['Niepotwierdzone / do odświeżenia', s.niepotwierdzone_lub_do_odswiezenia]]
  return <div className="tiles">{t.map(([k, v]) => <div className="tile" key={k}><strong>{v}</strong>{k}</div>)}</div>
}

export default function ValidationReport({ batchId, summary }) {
  const [level, setLevel] = useState('')
  const [dlErr, setDlErr] = useState(null)
  const { data, loading, error, reload } = useApi(() => getReport(batchId, level || undefined), [batchId, level])
  const rows = data?.problemy || []
  return (
    <section aria-labelledby="rep-h">
      <h2 id="rep-h">Krok 3. Raport walidacji</h2>
      <SummaryTiles s={summary} />
      <p className={summary.z_bledami ? 'alert bad' : 'alert ok'} role="status">
        {summary.z_bledami ? `${summary.z_bledami} rekordów z błędami blokującymi – zostaną odrzucone, jeśli zaznaczysz taką opcję przy zatwierdzeniu, albo popraw dane i wgraj ponownie.` : 'Brak błędów blokujących.'}
      </p>
      <div className="btn-row">
        <label htmlFor="rep-level">Pokaż:&nbsp;</label>
        <select id="rep-level" value={level} onChange={(e) => setLevel(e.target.value)} style={{ width: 'auto' }}>
          <option value="">Wszystkie problemy</option><option value="blad">Tylko błędy</option><option value="ostrzezenie">Tylko ostrzeżenia</option>
        </select>
        <button type="button" onClick={() => downloadReportCsv(batchId).catch(setDlErr)}>Pobierz raport CSV</button>
      </div>
      <ErrorSummary error={dlErr} />
      {loading && <Loading />}<LoadError error={error} onRetry={reload} />
      {data && <p className="small muted">Pozycji: {rows.length}</p>}
      {rows.length > 0 && (
        <div className="table-wrap">
          <table><thead><tr><th scope="col">Rekord</th><th scope="col">Poziom</th><th scope="col">Pole</th><th scope="col">Reguła</th><th scope="col">Komunikat</th></tr></thead>
            <tbody>{rows.slice(0, 500).map((r, i) => (
              <tr key={i}><td>{r.aed_id}</td><td><span className={`badge ${LEVEL[r.poziom].cls}`}>{LEVEL[r.poziom].text}</span></td><td>{r.pole || '—'}</td><td>{r.regula}</td><td>{r.komunikat}</td></tr>))}</tbody></table>
        </div>
      )}
    </section>
  )
}
