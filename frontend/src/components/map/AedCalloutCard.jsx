import { useEffect, useRef, useState } from 'react'
import { getAed } from '../../api/aed.js'
import { useApi } from '../../hooks/useApi.js'
import { formatDate, formatDistance, navUrl } from '../../lib/format.js'
import { aspectTone, STATUS, valueLabel } from '../../lib/labels.js'
import { FreshnessBadge } from '../common/StatusBadge.jsx'
import { LoadError, Loading } from '../common/Feedback.jsx'
import ReportDialog from './ReportDialog.jsx'
import UrgentPanel from './UrgentPanel.jsx'

const ASPECTS = [
  ['dostepnosc', 'Godziny'], ['bariera_dostepu', 'Dostęp do urządzenia'], ['ograniczenia_dostepu', 'Ograniczenia'], ['stan', 'Stan urządzenia'],
]

/** Zawartość kafelka wybranego AED (pozycjonowaniem zajmuje się MapCallout). Zamykany przyciskiem × i klawiszem Escape. */
export default function AedCalloutCard({ id, items, onSelect, onClose }) {
  const { data: a, loading, error, reload } = useApi(() => getAed(id), [id])
  const [reporting, setReporting] = useState(false)
  const [more, setMore] = useState(false)
  const titleRef = useRef(null)
  useEffect(() => { titleRef.current?.focus({ preventScroll: true }) }, [id])
  useEffect(() => {
    if (reporting) return undefined // Escape zamyka wtedy tylko okno zgłoszenia
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, reporting])

  const listed = items.find((i) => i.aed_id === id)
  const dist = listed?.odleglosc_m
  const st = a?.status_dostepnosci
  const s = STATUS[st?.wartosc] || STATUS.nieznany
  return (
    <article className="callout-card" aria-labelledby="callout-title">
      <header>
        <div>
          <p className="eyebrow">AED · <span className="mono">{id}</span></p>
          <h2 id="callout-title" tabIndex={-1} ref={titleRef}>{a ? `${a.adres}, ${a.miasto}` : listed ? `${listed.adres}, ${listed.miasto}` : 'Ładowanie…'}</h2>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Zamknij kafelek punktu">×</button>
      </header>
      {loading && !a && <Loading />}
      <LoadError error={error} onRetry={reload} />
      {a && (
        <>
          <div className="where">
            <p className="eyebrow">Gdzie dokładnie jest urządzenie</p>
            <p>{a.lokalizacja_w_obiekcie || <span className="muted">Dostawca nie podał miejsca w obiekcie.</span>}</p>
          </div>
          <div className="status-line">
            <span className={`badge badge-lg ${s.cls}`} title={st?.powod}><span aria-hidden="true">{s.icon}</span> {s.text}</span>
            <FreshnessBadge value={a.znacznik_aktualnosci} />
            {dist != null && <span className="dist-big" aria-label={`Odległość ${formatDistance(dist)}`}>{formatDistance(dist)}</span>}
          </div>
          <UrgentPanel aed={a} items={items} onSelect={onSelect} />
          <dl className="aspects">
            {ASPECTS.map(([field, label]) => (
              <div key={field}>
                <dt>{label}</dt>
                <dd><span className={`badge ${aspectTone(field, a[field])}`}>{valueLabel(field, a[field])}</span>
                  {field === 'dostepnosc' && a.godziny_dostepu && <span className="mono small"> {a.godziny_dostepu}</span>}
                  {field === 'ograniczenia_dostepu' && a.ograniczenia_opis && <span className="small"> {a.ograniczenia_opis}</span>}</dd>
              </div>
            ))}
          </dl>
          <div className="callout-actions">
            <a className="btn primary" href={navUrl(a.lat, a.lon)} target="_blank" rel="noreferrer">Nawiguj</a>
            <button type="button" aria-expanded={more} onClick={() => setMore((m) => !m)}>{more ? 'Ukryj szczegóły' : 'Szczegóły'}</button>
            <button type="button" onClick={() => setReporting(true)}>Zgłoś z terenu</button>
          </div>
          {more && (
            <div className="callout-more">
              {st?.powod && <p className="small">{st.powod}{st.brakujace?.length > 0 && <> · brak danych: {st.brakujace.join(', ')}</>}</p>}
              <dl className="facts">
                <dt>Współrzędne</dt><dd className="mono">{a.lat}, {a.lon}</dd>
                <dt>Ostatnie potwierdzenie</dt><dd>{formatDate(a.data_ostatniego_potwierdzenia)}</dd>
                <dt>Ostatnia edycja</dt><dd>{formatDate(a.data_ostatniej_edycji)}</dd>
                <dt>Ostatni import</dt><dd>{formatDate(a.data_importu)}</dd>
                <dt>Dostawca</dt><dd>{a.nazwa_dostawcy} (REGON <span className="mono">{a.regon_dostawcy}</span>)</dd>
                <dt>Podmiot zarządzający danymi</dt><dd>{a.dysponent_nazwa || '—'}</dd>
                <dt>Źródło</dt><dd>{a.zrodlo_danych}</dd>
                <dt>Zakres referencyjny</dt><dd>{a.zakres_referencyjny}</dd>
              </dl>
              {a.zrodla_skladowe?.length > 0 && (
                <ul className="small">{a.zrodla_skladowe.map((z, i) => <li key={i}>{z.zrodlo_nazwa || z.zrodlo_id} · licencja {z.licencja || '—'}{z.glowne && ' · główne'}</li>)}</ul>
              )}
              <h3>Uwagi społeczności</h3>
              <p className="small muted">Osobno od danych oficjalnych; nie wpływają na status ani aktualność.</p>
              {a.sygnaly?.ostrzezenie_dostepu && <p className="alert warn">Kilka osób zgłosiło, że urządzenie bywa zamknięte na klucz.</p>}
              <p className="small">{Object.entries(a.sygnaly || {}).filter(([k, v]) => k !== 'ostrzezenie_dostepu' && v).map(([k, v]) => `${k.replaceAll('_', ' ')}: ${v}`).join(' · ') || 'Brak zgłoszeń z ostatnich 90 dni.'}</p>
            </div>
          )}
        </>
      )}
      {reporting && <ReportDialog aedId={id} onClose={() => setReporting(false)} onSent={reload} />}
    </article>
  )
}
