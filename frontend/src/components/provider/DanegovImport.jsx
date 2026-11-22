import { useEffect, useState } from 'react'
import { getCatalog, importFromDanegov } from '../../api/danegov.js'
import { useApi } from '../../hooks/useApi.js'
import { formatDate } from '../../lib/format.js'
import ErrorSummary from '../common/ErrorSummary.jsx'
import { LoadError, Loading } from '../common/Feedback.jsx'

const UPSTREAM = { UPSTREAM_ERROR: 'Portal dane.gov.pl jest chwilowo niedostępny lub zwrócił błąd.', UPSTREAM_TIMEOUT: 'Portal dane.gov.pl nie odpowiedział w wyznaczonym czasie.' }

/** Import zbiorów AED opublikowanych w portalu dane.gov.pl. Dalej działa zwykły kreator (mapowanie, walidacja, oświadczenia). */
export default function DanegovImport({ onCreated }) {
  const [refresh, setRefresh] = useState(0)
  const { data, loading, error, reload } = useApi(() => getCatalog(refresh > 0), [refresh])
  const [sel, setSel] = useState(new Set())
  const [busy, setBusy] = useState(false)
  const [importError, setImportError] = useState(null)

  useEffect(() => { if (data) setSel(new Set(data.items.filter((i) => i.mozna_importowac).map((i) => i.dataset_id))) }, [data])
  const toggle = (id) => setSel((cur) => { const n = new Set(cur); n.has(id) ? n.delete(id) : n.add(id); return n })
  const err = error && { ...error, message: UPSTREAM[error.code] || error.message }

  const run = async () => {
    setBusy(true); setImportError(null)
    try { onCreated(await importFromDanegov([...sel])) }
    catch (e) { setImportError({ ...e, message: UPSTREAM[e.code] || e.message }) }
    finally { setBusy(false) }
  }
  return (
    <section aria-labelledby="dg-h">
      <h2 id="dg-h">Krok 1. Pobierz dane z portalu dane.gov.pl</h2>
      <p className="muted">Wyszukujemy w portalu zbiory z lokalizacjami defibrylatorów AED. Pobrane dane przechodzą ten sam proces co własne pliki: mapowanie, walidacja, duplikaty i Twoje oświadczenia.</p>
      <div className="alert info" role="note">
        <strong>Zanim zatwierdzisz:</strong> wydawca z portalu jest w aplikacji <em>podmiotem zarządzającym danymi</em>, a Ty – dostawcą, który ręczy oświadczeniem.
        Licencje (np. CC BY 4.0) wymagają atrybucji – zachowujemy ją przy źródle i w eksporcie. Źródła zwykle <strong>nie zawierają dostępności ani stanu urządzenia</strong>,
        więc punkty będą miały status „brak danych o dostępności”.
      </div>
      <div className="btn-row">
        <button type="button" onClick={() => setRefresh((n) => n + 1)} disabled={loading}>{loading ? 'Pobieranie katalogu…' : 'Odśwież katalog z portalu'}</button>
        {data && <span className="small muted" role="status">Katalog pobrano: {formatDate(data.pobrano)}. Źródło: {data.zrodlo}</span>}
      </div>
      {loading && !data && <Loading text="Przeszukiwanie portalu dane.gov.pl (może potrwać kilka sekund)…" />}
      <LoadError error={err} onRetry={reload} />
      {data && data.items.length === 0 && <p className="alert warn">W portalu nie znaleziono zbiorów z danymi o defibrylatorach.</p>}
      {data && data.items.length > 0 && (
        <div className="table-wrap">
          <table>
            <caption className="sr-only">Zbiory danych o AED w portalu dane.gov.pl</caption>
            <thead><tr><th scope="col"><span className="sr-only">Importuj</span></th><th scope="col">Zbiór</th><th scope="col">Wydawca (dysponent)</th><th scope="col">Licencja</th><th scope="col">Zasób</th><th scope="col">Uwagi</th></tr></thead>
            <tbody>
              {data.items.map((i) => (
                <tr key={i.dataset_id}>
                  <td><input type="checkbox" id={`dg-${i.dataset_id}`} checked={sel.has(i.dataset_id)} disabled={!i.mozna_importowac} onChange={() => toggle(i.dataset_id)}
                    aria-label={`Importuj: ${i.tytul}`} /></td>
                  <td><label htmlFor={`dg-${i.dataset_id}`}>{i.tytul}</label><br /><a className="small" href={i.strona_url} target="_blank" rel="noreferrer">Strona zbioru w portalu</a></td>
                  <td>{i.wydawca.nazwa}<br /><span className="small muted">REGON {i.wydawca.regon}</span></td>
                  <td>{i.licencja || '—'}</td>
                  <td>{i.zasob ? <>{i.zasob.format.toUpperCase()}<br /><span className="small muted">{formatDate(i.zasob.data)}</span></> : '—'}</td>
                  <td>{i.mozna_importowac ? <span className="badge ok">Można pobrać</span> : <span className="small"><span className="badge warn">Pominięty</span> {i.powod_pominiecia}</span>}
                    {i.aktualizacja && <div className="small muted">Aktualizacja wg wydawcy: {i.aktualizacja}</div>}</td>
                </tr>))}
            </tbody>
          </table>
        </div>
      )}
      <ErrorSummary error={importError} />
      {data && (
        <div className="btn-row">
          <button type="button" className="primary" disabled={busy || sel.size === 0} onClick={run}>
            {busy ? 'Pobieranie plików…' : `Importuj wybrane zbiory (${sel.size})`}</button>
        </div>)}
    </section>
  )
}
