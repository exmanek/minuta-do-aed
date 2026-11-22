import { exportUrls, getWykaz } from '../api/aed.js'
import DemoBanner from '../components/common/DemoBanner.jsx'
import { LoadError, Loading } from '../components/common/Feedback.jsx'
import WykazTable from '../components/standard/WykazTable.jsx'
import { useApi } from '../hooks/useApi.js'
import { formatDate } from '../lib/format.js'

export default function WykazPage() {
  const { data, loading, error, reload } = useApi(() => getWykaz(), [])
  return (
    <>
      <h1>Wykaz defibrylatorów AED</h1>
      <p className="muted">Zasób tabelaryczny przygotowany do publikacji w dane.gov.pl: zatwierdzone punkty od dostawców, w zakresie kolumn wzorca danych. Pliki poniżej są gotowe do zaimportowania w portalu.</p>
      <DemoBanner visible={!!data?.dane_przykladowe} />
      {loading && <Loading />}
      <LoadError error={error} onRetry={reload} />
      {data && (
        <>
          <div className="btn-row">
            <a className="btn primary" href={exportUrls.wykazCsv} download>Pobierz CSV</a>
            <a className="btn" href={exportUrls.wykazJson} download>Pobierz JSON</a>
            <a className="btn" href={exportUrls.metadataXml} download>Metryczka zbioru (XML)</a>
            <a className="btn" href={exportUrls.metadataJson} download>Metryczka (JSON)</a>
          </div>
          <p className="small muted">Stan na <strong>{formatDate(data.data_wygenerowania)}</strong>. Pobranie plików nie jest publikacją w dane.gov.pl – prototyp nie wysyła zbioru do portalu.</p>
          <WykazTable columns={data.kolumny} rows={data.items} />
        </>
      )}
    </>
  )
}
