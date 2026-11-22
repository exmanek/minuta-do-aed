import { formatDistance } from '../../lib/format.js'
import { StatusBadge, FreshnessBadge } from '../common/StatusBadge.jsx'

export default function AedList({ items, selected, onSelect }) {
  return (
    <ul className="aed-list" aria-label="Lista punktów AED">
      {items.map((i) => (
        <li key={i.aed_id}>
          <button type="button" className="aed-item" aria-current={i.aed_id === selected} onClick={() => onSelect(i.aed_id)}>
            <span className="row">
              <strong>{i.adres || 'Brak adresu'}, {i.miasto}</strong>
              {i.odleglosc_m != null && <span>{formatDistance(i.odleglosc_m)}</span>}
            </span>
            {i.lokalizacja_w_obiekcie && <span className="small muted">{i.lokalizacja_w_obiekcie}</span>}
            <span className="row" style={{ marginTop: 4 }}>
              <StatusBadge status={i.status_dostepnosci} />
              <FreshnessBadge value={i.znacznik_aktualnosci} />
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
