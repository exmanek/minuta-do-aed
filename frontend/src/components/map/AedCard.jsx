import { useState } from 'react'
import { getAed } from '../../api/aed.js'
import { useApi } from '../../hooks/useApi.js'
import { formatDate, formatDistance, navUrl } from '../../lib/format.js'
import { valueLabel } from '../../lib/labels.js'
import { FreshnessBadge, StatusBadge } from '../common/StatusBadge.jsx'
import { LoadError, Loading } from '../common/Feedback.jsx'
import ReportDialog from './ReportDialog.jsx'
import UrgentPanel from './UrgentPanel.jsx'

export default function AedCard({ id, items, onSelect, onClose }) {
  const { data: a, loading, error, reload } = useApi(() => getAed(id), [id])
  const [reporting, setReporting] = useState(false)
  if (loading && !a) return <Loading />
  if (error) return <LoadError error={error} onRetry={reload} />
  if (!a) return null
  const dist = items.find((i) => i.aed_id === id)?.odleglosc_m
  const st = a.status_dostepnosci
  return (
    <article className="card" aria-labelledby="card-title">
      <div className="row" style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <h2 id="card-title" style={{ margin: 0 }}>{a.adres}, {a.miasto}</h2>
        <button type="button" onClick={onClose} aria-label="Zamknij kartę punktu">✕</button>
      </div>
      {a.lokalizacja_w_obiekcie && <p><strong>Gdzie dokładnie:</strong> {a.lokalizacja_w_obiekcie}</p>}
      {dist != null && <p className="muted">Odległość: {formatDistance(dist)}</p>}
      <p><StatusBadge status={st} /> <FreshnessBadge value={a.znacznik_aktualnosci} /></p>
      <UrgentPanel aed={a} items={items} onSelect={onSelect} />
      {st && <p className="small">{st.powod}{st.brakujace?.length > 0 && <> · brak danych: {st.brakujace.join(', ')}</>}</p>}
      <div className="btn-row">
        <a className="btn primary" href={navUrl(a.lat, a.lon)} target="_blank" rel="noreferrer">Nawiguj do punktu</a>
        <button type="button" onClick={() => setReporting(true)}>Zgłoś problem</button>
      </div>
      <h3>Dostępność (cztery osobne aspekty)</h3>
      <dl className="facts">
        <dt>Godziny dostępności</dt><dd>{valueLabel('dostepnosc', a.dostepnosc)}{a.godziny_dostepu && ` (${a.godziny_dostepu})`}</dd>
        <dt>Fizyczny dostęp do urządzenia</dt><dd>{valueLabel('bariera_dostepu', a.bariera_dostepu)}</dd>
        <dt>Ograniczenia dostępu</dt><dd>{valueLabel('ograniczenia_dostepu', a.ograniczenia_dostepu)}{a.ograniczenia_opis && ` – ${a.ograniczenia_opis}`}</dd>
        <dt>Stan urządzenia</dt><dd>{valueLabel('stan', a.stan)}</dd>
      </dl>
      <h3>Aktualność danych</h3>
      <dl className="facts">
        <dt>Ostatnie potwierdzenie</dt><dd>{formatDate(a.data_ostatniego_potwierdzenia)}</dd>
        <dt>Ostatnia edycja</dt><dd>{formatDate(a.data_ostatniej_edycji)}</dd>
        <dt>Ostatni import</dt><dd>{formatDate(a.data_importu)}</dd>
      </dl>
      <h3>Pochodzenie danych</h3>
      <dl className="facts">
        <dt>Dostawca</dt><dd>{a.nazwa_dostawcy} (REGON {a.regon_dostawcy})</dd>
        <dt>Podmiot zarządzający danymi</dt><dd>{a.dysponent_nazwa || '—'}</dd>
        <dt>Źródło</dt><dd>{a.zrodlo_danych}</dd>
        <dt>Zakres referencyjny</dt><dd>{a.zakres_referencyjny}</dd>
      </dl>
      {a.zrodla_skladowe?.length > 0 && (
        <details><summary>Źródła składowe ({a.zrodla_skladowe.length})</summary>
          <ul>{a.zrodla_skladowe.map((s, i) => <li key={i}>{s.zrodlo_nazwa || s.zrodlo_id} · licencja {s.licencja || '—'}{s.glowne && ' · główne'}</li>)}</ul>
        </details>
      )}
      <h3>Uwagi społeczności</h3>
      <p className="small muted">Osobno od danych oficjalnych; nie wpływają na status ani aktualność.</p>
      {a.sygnaly?.ostrzezenie_dostepu && <p className="alert warn">Kilka osób zgłosiło, że urządzenie bywa zamknięte na klucz.</p>}
      <p className="small">{Object.entries(a.sygnaly || {}).filter(([k, v]) => k !== 'ostrzezenie_dostepu' && v).map(([k, v]) => `${k.replaceAll('_', ' ')}: ${v}`).join(' · ') || 'Brak zgłoszeń z ostatnich 90 dni.'}</p>
      {reporting && <ReportDialog aedId={id} onClose={() => setReporting(false)} onSent={reload} />}
    </article>
  )
}
