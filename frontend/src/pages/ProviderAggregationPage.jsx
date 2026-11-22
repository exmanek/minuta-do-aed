import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { commitBatch, getBatch, processBatch, putMapping } from '../api/provider.js'
import { useSchema } from '../auth/SchemaContext.jsx'
import ErrorSummary from '../components/common/ErrorSummary.jsx'
import { LoadError, Loading } from '../components/common/Feedback.jsx'
import DeclarationBox, { declarationsComplete, emptyDeclarations } from '../components/provider/DeclarationBox.jsx'
import DuplicatesReview from '../components/provider/DuplicatesReview.jsx'
import ExportPanel from '../components/provider/ExportPanel.jsx'
import MappingTable, { hasDuplicateTargets } from '../components/provider/MappingTable.jsx'
import UploadPanel from '../components/provider/UploadPanel.jsx'
import ValidationReport from '../components/provider/ValidationReport.jsx'
import { useApi } from '../hooks/useApi.js'
import { mappingFromBatch } from '../lib/mapping.js'

const STEPS = ['Wgraj źródła', 'Zmapuj kolumny', 'Raport walidacji', 'Duplikaty', 'Zatwierdź i eksportuj']
const stepOf = (status) => ({ wczytana: 1, zmapowana: 1, przetworzona: 2, zatwierdzona: 4 })[status] ?? 0

export default function ProviderAggregationPage() {
  const [sp, setSp] = useSearchParams()
  const batchId = sp.get('batch')
  const { schema } = useSchema()
  const { data: batch, loading, error, reload } = useApi(() => (batchId ? getBatch(batchId) : null), [batchId])
  const [mapping, setMapping] = useState({})
  const [decl, setDecl] = useState(emptyDeclarations())
  const [version, setVersion] = useState('v1')
  const [reject, setReject] = useState(false)
  const [busy, setBusy] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [commitResult, setCommitResult] = useState(null)

  useEffect(() => { if (batch) setMapping(mappingFromBatch(batch)) }, [batch?.batch_id, batch?.status]) // eslint-disable-line react-hooks/exhaustive-deps
  const fields = useMemo(() => (schema ? schema.pola.filter((p) => p.status !== 'wyliczane') : []), [schema])
  const current = batch ? stepOf(batch.status) : 0
  const dupCount = batch?.podsumowanie ? batch.podsumowanie.kandydaci_duplikatow.w_partii + batch.podsumowanie.kandydaci_duplikatow.wzgledem_bazy : 0

  const run = async (name, fn) => {
    setBusy(name); setActionError(null)
    try { return await fn() } catch (e) { setActionError(e); return null } finally { setBusy(null) }
  }
  const approve = () => run('map', async () => { await putMapping(batchId, mapping); reload() })
  const process = () => run('proc', async () => { await putMapping(batchId, mapping); await processBatch(batchId); reload() })
  const commit = () => run('commit', async () => {
    const r = await commitBatch(batchId, { oswiadczenie_prawdziwosci: decl.prawdziwosc, oswiadczenie_prawa_do_udostepniania: decl.prawo_do_udostepniania,
      potwierdzam_aktualnosc: decl.aktualnosc, wersja_tresci: version, odrzuc_bledne: reject })
    setCommitResult(r); reload()
  })

  return (
    <>
      <h1>Import danych (panel dostawcy)</h1>
      <ol className="steps" aria-label="Postęp">{STEPS.map((s, i) => <li key={s} aria-current={i === current ? 'step' : undefined} className={i < current ? 'done' : ''}>{s}</li>)}</ol>
      <ErrorSummary error={actionError} />
      {!batchId && <UploadPanel onCreated={(b) => setSp({ batch: b.batch_id })} />}
      {batchId && loading && !batch && <Loading />}
      <LoadError error={error} onRetry={reload} />
      {batch && (
        <>
          <p className="small muted">Partia <code>{batch.batch_id}</code> · stan: <strong>{batch.status}</strong> · <button type="button" onClick={() => setSp({})}>Wgraj nową partię</button></p>
          {['wczytana', 'zmapowana'].includes(batch.status) && (
            <section aria-labelledby="map-h">
              <h2 id="map-h">Krok 2. Mapowanie kolumn na pola wzorca</h2>
              <p className="muted">Sprawdź propozycje. Zatwierdzone mapowanie zostanie zapamiętane dla tego źródła.</p>
              {batch.zrodla.map((z) => <MappingTable key={z.zrodlo_id} source={z} fields={fields} value={mapping[z.zrodlo_id] || {}}
                onChange={(m) => setMapping((cur) => ({ ...cur, [z.zrodlo_id]: m }))} />)}
              <div className="btn-row">
                <button type="button" disabled={busy || Object.values(mapping).some(hasDuplicateTargets)} onClick={approve}>{busy === 'map' ? 'Zapisywanie…' : 'Zatwierdź mapowanie'}</button>
                <button type="button" className="primary" disabled={busy || Object.values(mapping).some(hasDuplicateTargets)} onClick={process}>{busy === 'proc' ? 'Przetwarzanie…' : 'Zatwierdź mapowanie i zwaliduj'}</button>
              </div>
            </section>
          )}
          {batch.status === 'przetworzona' && batch.podsumowanie && (
            <>
              <ValidationReport batchId={batch.batch_id} summary={batch.podsumowanie} />
              {dupCount > 0 && <DuplicatesReview batchId={batch.batch_id} onSaved={reload} />}
              <section aria-labelledby="commit-h">
                <h2 id="commit-h">Krok 5. Oświadczenia i zatwierdzenie</h2>
                <p className="muted">„Zatwierdzenie” oznacza zatwierdzenie danych w tym prototypie. To nie jest publikacja w dane.gov.pl.</p>
                <DeclarationBox value={decl} onChange={setDecl} onVersion={setVersion}>
                  {batch.podsumowanie.z_bledami > 0 && (
                    <div className="check"><input id="decl-reject" type="checkbox" checked={reject} onChange={(e) => setReject(e.target.checked)} />
                      <label htmlFor="decl-reject">Odrzuć {batch.podsumowanie.z_bledami} rekordów z błędami blokującymi i zatwierdź pozostałe</label></div>)}
                </DeclarationBox>
                <div className="btn-row">
                  <button type="button" className="primary" disabled={busy || !declarationsComplete(decl) || (batch.podsumowanie.z_bledami > 0 && !reject)} onClick={commit}>
                    {busy === 'commit' ? 'Zatwierdzanie…' : 'Zatwierdź dane w prototypie'}</button>
                </div>
                {!declarationsComplete(decl) && <p className="small muted" role="note">Zaznacz oba wymagane oświadczenia.</p>}
                {batch.podsumowanie.z_bledami > 0 && !reject && <p className="small muted" role="note">Są błędy blokujące – zaznacz odrzucenie błędnych rekordów albo popraw dane i wgraj ponownie.</p>}
              </section>
            </>
          )}
          {batch.status === 'zatwierdzona' && <ExportPanel batchId={batch.batch_id} result={commitResult} />}
        </>
      )}
    </>
  )
}
