import { useState } from 'react'
import { downloadBatchExport } from '../../api/provider.js'
import { exportUrls } from '../../api/aed.js'
import ErrorSummary from '../common/ErrorSummary.jsx'

export default function ExportPanel({ batchId, result }) {
  const [err, setErr] = useState(null)
  const dl = (fmt) => downloadBatchExport(batchId, fmt).catch(setErr)
  return (
    <section aria-labelledby="exp-h">
      <h2 id="exp-h">Krok 5. Zatwierdzone i gotowe do eksportu</h2>
      {result && <p className="alert ok" role="status">Zatwierdzono rekordów: <strong>{result.zatwierdzone}</strong>, odrzucono: {result.odrzucone}, scalono: {result.scalone}.</p>}
      <p className="alert info"><strong>Pobranie plików nie jest publikacją w dane.gov.pl.</strong> Paczkę publikujesz samodzielnie ze swojego konta w portalu. Prototyp nie wie, czy publikacja nastąpiła{result?.publikacja_dane_gov_pl && ` (status: ${result.publikacja_dane_gov_pl})`}.</p>
      <ErrorSummary error={err} />
      <h3>Pliki tej partii</h3>
      <div className="btn-row">{['csv', 'json', 'geojson', 'zip'].map((f) => <button key={f} type="button" onClick={() => dl(f)}>Pobierz {f.toUpperCase()}</button>)}</div>
      <h3>Pełny zbiór (publiczne linki)</h3>
      <ul>
        <li><a href={exportUrls.csv} download>aed.csv</a> · <a href={exportUrls.json} download>aed.json</a> · <a href={exportUrls.geojson} download>aed.geojson</a></li>
        <li><a href={exportUrls.zrodla} download>zrodla.csv</a> (źródła, zakresy, licencje) · <a href={exportUrls.aedZrodla} download>aed_zrodla.csv</a></li>
        <li><a href={exportUrls.metadataJson} download>metadata.json</a> · <a href={exportUrls.metadataXml} download>metadata.xml</a> <span className="muted small">(wersja robocza; licencja zbioru i kategoria do ustalenia)</span></li>
      </ul>
    </section>
  )
}
