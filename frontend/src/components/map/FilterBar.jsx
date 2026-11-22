import { STATUS } from '../../lib/labels.js'

const RADII = [500, 1000, 2000, 5000]

/** Kontrolowany formularz filtrów. f = { dostepnosc_teraz, tylko_aktualne, status[], radius_m } */
export default function FilterBar({ f, onChange, hasPos }) {
  const set = (patch) => onChange({ ...f, ...patch })
  const toggleStatus = (s) => set({ status: f.status.includes(s) ? f.status.filter((x) => x !== s) : [...f.status, s] })
  return (
    <details className="card" open>
      <summary><strong>Filtry</strong></summary>
      <div className="grid2" style={{ marginTop: 8 }}>
        <div>
          <div className="check"><input id="f-teraz" type="checkbox" checked={f.dostepnosc_teraz} onChange={(e) => set({ dostepnosc_teraz: e.target.checked })} />
            <label htmlFor="f-teraz">Ukryj niedostępne teraz <span className="muted small">(punkty z brakiem danych zostają na liście)</span></label></div>
          <div className="check"><input id="f-akt" type="checkbox" checked={f.tylko_aktualne} onChange={(e) => set({ tylko_aktualne: e.target.checked })} />
            <label htmlFor="f-akt">Tylko aktualne (potwierdzone w ciągu 12 miesięcy)</label></div>
          <div className="field">
            <label htmlFor="f-radius">Promień wyszukiwania</label>
            <select id="f-radius" value={f.radius_m} disabled={!hasPos} onChange={(e) => set({ radius_m: Number(e.target.value) })} aria-describedby="f-radius-h">
              {RADII.map((r) => <option key={r} value={r}>{r < 1000 ? `${r} m` : `${r / 1000} km`}</option>)}
            </select>
            <p className="hint" id="f-radius-h">{hasPos ? '' : 'Ustaw lokalizację, aby ograniczyć wyniki do promienia.'}</p>
          </div>
        </div>
        <fieldset style={{ margin: 0 }}>
          <legend>Status dostępności</legend>
          {Object.entries(STATUS).map(([k, s]) => (
            <div className="check" key={k}><input id={`f-s-${k}`} type="checkbox" checked={f.status.includes(k)} onChange={() => toggleStatus(k)} />
              <label htmlFor={`f-s-${k}`}>{s.text}</label></div>
          ))}
          <p className="hint small muted">Bez zaznaczenia pokazywane są wszystkie statusy.</p>
        </fieldset>
      </div>
    </details>
  )
}
