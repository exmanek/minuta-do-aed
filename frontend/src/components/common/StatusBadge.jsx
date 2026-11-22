import { FRESHNESS, STATUS } from '../../lib/labels.js'

/** Status nie zależy wyłącznie od koloru: ikona + tekst. Tekst pochodzi z backendu (wartość), nie jest liczony we froncie. */
export function StatusBadge({ status }) {
  const s = STATUS[status?.wartosc] || STATUS.nieznany
  return <span className={`badge ${s.cls}`} title={status?.powod || s.help}><span aria-hidden="true">{s.icon}</span> {s.text}</span>
}
export function FreshnessBadge({ value }) {
  const f = FRESHNESS[value] || FRESHNESS.niepotwierdzone
  return <span className={`badge ${f.cls}`}>{f.text}</span>
}
