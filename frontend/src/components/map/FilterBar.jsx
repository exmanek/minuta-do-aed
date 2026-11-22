import { STATUS } from '../../lib/labels.js'

/** Kontrolowany formularz filtrów. f = { dostepnosc_teraz, tylko_aktualne, status[] } */
export default function FilterBar({ f, onChange }) {
  const set = (patch) => onChange({ ...f, ...patch })
  const toggleStatus = (s) => set({ status: f.status.includes(s) ? f.status.filter((x) => x !== s) : [...f.status, s] })
  const active = (f.dostepnosc_teraz ? 1 : 0) + (f.tylko_aktualne ? 1 : 0) + f.status.length
  return (
    <details className="filters">
      <summary>Filtry{active > 0 && <span className="count" aria-label={`aktywne: ${active}`}>{active}</span>}</summary>
      <div className="check"><input id="f-teraz" type="checkbox" checked={f.dostepnosc_teraz} onChange={(e) => set({ dostepnosc_teraz: e.target.checked })} />
        <label htmlFor="f-teraz">Ukryj niedostępne teraz <span className="muted small">(punkty z brakiem danych zostają)</span></label></div>
      <div className="check"><input id="f-akt" type="checkbox" checked={f.tylko_aktualne} onChange={(e) => set({ tylko_aktualne: e.target.checked })} />
        <label htmlFor="f-akt">Tylko aktualne (potwierdzone w ciągu 12 miesięcy)</label></div>
      <fieldset>
        <legend>Status dostępności</legend>
        {Object.entries(STATUS).map(([k, s]) => (
          <div className="check" key={k}><input id={`f-s-${k}`} type="checkbox" checked={f.status.includes(k)} onChange={() => toggleStatus(k)} />
            <label htmlFor={`f-s-${k}`}>{s.text}</label></div>
        ))}
        <p className="hint small muted">Bez zaznaczenia pokazywane są wszystkie statusy.</p>
      </fieldset>
    </details>
  )
}
