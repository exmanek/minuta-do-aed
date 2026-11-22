import { useState } from 'react'
import { valueLabel } from '../../lib/labels.js'

const STATUS_TXT = { wymagane: 'Wymagane', warunkowo_wymagane: 'Warunkowo wymagane', opcjonalne: 'Opcjonalne', wyliczane: 'Wyliczane przez system' }

export default function SchemaTable({ fields, slowniki, caption, showDict = true }) {
  const [status, setStatus] = useState('')
  const rows = fields.filter((f) => !status || f.status === status)
  return (
    <section>
      <div className="btn-row"><label htmlFor={`flt-${caption}`}>Filtr statusu:&nbsp;</label>
        <select id={`flt-${caption}`} value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 'auto' }}>
          <option value="">Wszystkie</option>{Object.entries(STATUS_TXT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      <div className="table-wrap"><table>
        <caption className="sr-only">{caption}</caption>
        <thead><tr><th scope="col">Pole</th><th scope="col">Etykieta</th><th scope="col">Status</th><th scope="col">Typ</th><th scope="col">Opis</th><th scope="col">Przykład</th>{showDict && <th scope="col">Dozwolone wartości</th>}</tr></thead>
        <tbody>{rows.map((f) => (
          <tr key={f.nazwa}><td><code>{f.nazwa}</code></td><td>{f.etykieta}</td><td>{STATUS_TXT[f.status] || f.status}</td><td>{f.typ}</td><td>{f.opis}</td><td>{f.przyklad || '—'}</td>
            {showDict && <td>{slowniki[f.nazwa] ? slowniki[f.nazwa].map((v) => valueLabel(f.nazwa, v) === v ? v : `${v} (${valueLabel(f.nazwa, v)})`).join(', ') : '—'}</td>}</tr>))}</tbody>
      </table></div>
    </section>
  )
}
