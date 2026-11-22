/** Skąd pochodzi pozycja użytkownika. Służy tylko do orientacyjnych odległości – nie ogranicza widocznych punktów. */
const TEXT = {
  gps: 'Twoja lokalizacja (GPS)',
  link: 'Pozycja z linku',
  none: 'Lokalizacja niedostępna – odległości nie są liczone',
}

export default function LocationStatus({ source, loading, error, onLocate }) {
  return (
    <div className="location" role="status" aria-live="polite">
      {loading ? <p>Ustalanie Twojej lokalizacji…</p> : <p><strong>{TEXT[source]}</strong></p>}
      {error && !loading && <p className="small">{error} Mapa pokazuje wszystkie punkty w Polsce.</p>}
      {!loading && source !== 'gps' && <button type="button" onClick={onLocate}>Użyj mojej lokalizacji</button>}
    </div>
  )
}
