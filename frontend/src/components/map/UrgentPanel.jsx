import { formatDistance } from '../../lib/format.js'
import { StatusBadge } from '../common/StatusBadge.jsx'

/** Ostrzeżenie dla punktu niedostępnego/z ograniczeniami + propozycja następnego punktu z listy. */
export default function UrgentPanel({ aed, items, onSelect }) {
  const v = aed?.status_dostepnosci?.wartosc
  if (!aed || !['niedostepny', 'ograniczony_dostep', 'nieznany'].includes(v)) return null
  const others = items.filter((i) => i.aed_id !== aed.aed_id)
  const next = others.find((i) => i.status_dostepnosci?.wartosc === 'dostepny') || others.find((i) => i.status_dostepnosci?.wartosc !== 'niedostepny')
  const text = v === 'nieznany' ? 'Brak danych o dostępności tego punktu. To nie znaczy, że jest niedostępny – ale sprawdź inny punkt równolegle.'
    : v === 'niedostepny' ? 'Ten punkt jest teraz niedostępny.' : 'Dostęp do tego punktu jest ograniczony.'
  return (
    <div className={`alert ${v === 'niedostepny' ? 'bad' : 'warn'}`} role="alert">
      <strong>{text}</strong>
      {aed.status_dostepnosci?.powod && <p style={{ margin: '4px 0' }}>Powód: {aed.status_dostepnosci.powod}.</p>}
      {next ? (
        <p style={{ margin: '4px 0' }}>Następny punkt: {next.adres}, {next.miasto}{next.odleglosc_m != null && ` (${formatDistance(next.odleglosc_m)})`} <StatusBadge status={next.status_dostepnosci} />{' '}
          <button type="button" onClick={() => onSelect(next.aed_id)}>Pokaż ten punkt</button></p>
      ) : <p style={{ margin: '4px 0' }}>Brak innego punktu na liście. Zwiększ promień lub zadzwoń pod 112.</p>}
    </div>
  )
}
