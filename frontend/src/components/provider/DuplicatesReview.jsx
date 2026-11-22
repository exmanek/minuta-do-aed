import { useEffect, useState } from 'react'
import { getDuplicates, postDecisions } from '../../api/provider.js'
import { useApi } from '../../hooks/useApi.js'
import { formatDistance } from '../../lib/format.js'
import ErrorSummary from '../common/ErrorSummary.jsx'
import { LoadError, Loading } from '../common/Feedback.jsx'

const Card = ({ c }) => c ? (
  <dl className="facts"><dt>Adres</dt><dd>{c.adres}, {c.miasto}</dd><dt>Gdzie</dt><dd>{c.lokalizacja_w_obiekcie || '—'}</dd>
    <dt>Współrzędne</dt><dd>{c.lat}, {c.lon}</dd><dt>Źródło</dt><dd>{c.zrodlo_danych}</dd></dl>) : <p className="muted">Brak danych rekordu.</p>

/** Decyzje o duplikatach. Domyślnie żadna para nie jest scalana; „Scal” niedostępne dla rekordów innych dostawców. */
export default function DuplicatesReview({ batchId, onSaved }) {
  const { data, loading, error, reload } = useApi(() => getDuplicates(batchId), [batchId])
  const [dec, setDec] = useState({})
  const [saveErr, setSaveErr] = useState(null)
  const [saved, setSaved] = useState(false)
  useEffect(() => { if (data) setDec(Object.fromEntries(data.items.filter((c) => c.decyzja !== 'brak').map((c) => [`${c.aed_a}|${c.aed_b}`, c.decyzja]))) }, [data])
  if (loading && !data) return <Loading />
  if (error) return <LoadError error={error} onRetry={reload} />
  if (!data.items.length) return null
  const save = async () => {
    setSaveErr(null); setSaved(false)
    const decyzje = Object.entries(dec).map(([k, v]) => { const [aed_a, aed_b] = k.split('|'); return { aed_a, aed_b, decyzja: v } })
    try { await postDecisions(batchId, decyzje); setSaved(true); onSaved?.(); reload() } catch (e) { setSaveErr(e) }
  }
  return (
    <section aria-labelledby="dup-h">
      <h2 id="dup-h">Krok 4. Możliwe duplikaty</h2>
      <p className="muted">Nic nie jest scalane automatycznie. Nierozstrzygnięta para zostaje jako dwa osobne rekordy z ostrzeżeniem AED-DUP-001.</p>
      <ErrorSummary error={saveErr} />
      {data.items.map((c) => {
        const k = `${c.aed_a}|${c.aed_b}`, name = `dup-${k}`
        return (
          <fieldset key={k}>
            <legend>Para: {c.typ === 'w_partii' ? 'w tej partii' : 'rekord już w bazie'} · {c.pewnosc === 'prawdopodobny' ? 'prawdopodobny duplikat' : 'możliwy duplikat'}</legend>
            <p className="small">Odległość: {formatDistance(c.odleglosc_m)} · podobieństwo adresu: {Math.round(c.podobienstwo_adresu * 100)}%</p>
            <div className="grid2"><div><h3>Rekord z tej partii</h3><Card c={c.karta_a} /></div><div><h3>Drugi rekord</h3><Card c={c.karta_b} /></div></div>
            <div role="radiogroup" aria-label="Decyzja">
              <div className="check"><input type="radio" id={`${name}-0`} name={name} checked={(dec[k] || 'zostaw_oba') === 'zostaw_oba'} onChange={() => setDec({ ...dec, [k]: 'zostaw_oba' })} /><label htmlFor={`${name}-0`}>Zostaw oba rekordy</label></div>
              <div className="check"><input type="radio" id={`${name}-1`} name={name} disabled={!c.wlasny_rekord_b} checked={dec[k] === 'scal'} onChange={() => setDec({ ...dec, [k]: 'scal' })} />
                <label htmlFor={`${name}-1`}>Scal w jeden rekord (wszystkie źródła zostaną zachowane){!c.wlasny_rekord_b && <span className="muted"> – niedostępne: rekord należy do innego dostawcy (REGON {c.wlasciciel_b})</span>}</label></div>
            </div>
          </fieldset>)
      })}
      <div className="btn-row"><button type="button" className="primary" onClick={save}>Zapisz decyzje</button></div>
      {saved && <p className="alert ok" role="status">Decyzje zapisane.</p>}
    </section>
  )
}
