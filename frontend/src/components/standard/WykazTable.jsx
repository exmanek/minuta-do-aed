import { useMemo, useState } from 'react'
import { formatDate } from '../../lib/format.js'
import { valueLabel } from '../../lib/labels.js'
import { FreshnessBadge } from '../common/StatusBadge.jsx'

const NUMERIC = new Set(['lat', 'lon'])
const PAGE_SIZES = [10, 25, 50, 100]

function Cell({ name, value }) {
  if (value == null || value === '') return <span className="muted">—</span>
  if (name === 'znacznik_aktualnosci') return <FreshnessBadge value={value} />
  if (name === 'data_ostatniego_potwierdzenia') return formatDate(value)
  if (NUMERIC.has(name) || name === 'aed_id') return <span className="mono">{value}</span>
  return valueLabel(name, value)
}

const text = (name, value) => (value == null ? '' : name === 'znacznik_aktualnosci' ? String(value) : valueLabel(name, value))

/** Tabela wykazu: wyszukiwanie, sortowanie po kolumnie (aria-sort), stronicowanie. Kolumny i ich kolejność dostarcza backend. */
export default function WykazTable({ columns, rows }) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState({ name: null, dir: 'asc' })
  const [size, setSize] = useState(25)
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q ? rows.filter((r) => columns.some((c) => text(c.nazwa, r[c.nazwa]).toLowerCase().includes(q))) : rows
    if (!sort.name) return list
    const k = sort.name, f = sort.dir === 'asc' ? 1 : -1
    return [...list].sort((a, b) => {
      if (a[k] == null || a[k] === '') return 1
      if (b[k] == null || b[k] === '') return -1
      return (NUMERIC.has(k) ? Number(a[k]) - Number(b[k]) : String(text(k, a[k])).localeCompare(String(text(k, b[k])), 'pl')) * f
    })
  }, [rows, columns, query, sort])

  const pages = Math.max(1, Math.ceil(filtered.length / size))
  const cur = Math.min(page, pages - 1)
  const shown = filtered.slice(cur * size, cur * size + size)
  const toggle = (name) => { setSort((s) => (s.name === name ? { name, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { name, dir: 'asc' })); setPage(0) }

  return (
    <section aria-label="Wykaz AED">
      <div className="wykaz-tools">
        <div className="field">
          <label htmlFor="wykaz-q">Szukaj w tabeli</label>
          <input id="wykaz-q" type="search" value={query} onChange={(e) => { setQuery(e.target.value); setPage(0) }} placeholder="adres, miasto, dysponent…" />
        </div>
        <div className="field">
          <label htmlFor="wykaz-size">Wierszy na stronie</label>
          <select id="wykaz-size" value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(0) }}>
            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>
      <p className="small muted" role="status" aria-live="polite">Wierszy: <strong className="mono">{filtered.length}</strong>{filtered.length !== rows.length && ` z ${rows.length}`} · kolumn: <strong className="mono">{columns.length}</strong></p>
      <div className="table-wrap wykaz">
        <table>
          <caption className="sr-only">Wykaz defibrylatorów AED</caption>
          <thead>
            <tr>{columns.map((c) => (
              <th key={c.nazwa} scope="col" aria-sort={sort.name === c.nazwa ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <button type="button" className="th-sort" onClick={() => toggle(c.nazwa)}>
                  {c.etykieta}<span aria-hidden="true">{sort.name === c.nazwa ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ' ↕'}</span>
                </button>
              </th>))}</tr>
          </thead>
          <tbody>
            {shown.map((r) => <tr key={r.aed_id}>{columns.map((c) => <td key={c.nazwa}><Cell name={c.nazwa} value={r[c.nazwa]} /></td>)}</tr>)}
            {shown.length === 0 && <tr><td colSpan={columns.length}>Brak wierszy dla tego wyszukiwania.</td></tr>}
          </tbody>
        </table>
      </div>
      <nav className="pager" aria-label="Stronicowanie tabeli">
        <button type="button" onClick={() => setPage(cur - 1)} disabled={cur === 0}>Poprzednia</button>
        <span className="small" aria-live="polite">Strona <strong className="mono">{cur + 1}</strong> z <strong className="mono">{pages}</strong></span>
        <button type="button" onClick={() => setPage(cur + 1)} disabled={cur >= pages - 1}>Następna</button>
      </nav>
    </section>
  )
}
