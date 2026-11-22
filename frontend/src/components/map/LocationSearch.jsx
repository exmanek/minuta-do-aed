import { useEffect, useState } from 'react'
import { useGeolocation } from '../../hooks/useGeolocation.js'
import Field from '../common/Field.jsx'

/** Lokalizacja: GPS albo ręcznie (współrzędne). Geokodowania adresu nie ma – podstawą jest GPS i kliknięcie w mapę. */
export default function LocationSearch({ pos, onPos, onClear }) {
  const geo = useGeolocation()
  const [lat, setLat] = useState('')
  const [lon, setLon] = useState('')
  const [err, setErr] = useState(null)
  const useGps = () => geo.locate()
  useEffect(() => { if (geo.pos) onPos(geo.pos) }, [geo.pos]) // eslint-disable-line react-hooks/exhaustive-deps
  const submit = (e) => {
    e.preventDefault()
    const la = Number(String(lat).replace(',', '.')), lo = Number(String(lon).replace(',', '.'))
    if (!lat || !lon || Number.isNaN(la) || Number.isNaN(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) return setErr('Podaj poprawne współrzędne (np. 52.2297 i 21.0122).')
    setErr(null); onPos({ lat: la, lon: lo })
  }
  return (
    <section className="card" aria-label="Twoja lokalizacja">
      <div className="btn-row" style={{ marginTop: 0 }}>
        <button type="button" className="primary" onClick={useGps} disabled={geo.loading}>{geo.loading ? 'Ustalanie…' : 'Użyj mojej lokalizacji'}</button>
        {pos && <button type="button" onClick={onClear}>Wyczyść lokalizację</button>}
      </div>
      {geo.error && <p className="alert warn" role="alert">{geo.error}</p>}
      {pos && <p className="small" role="status">Lokalizacja: {pos.lat.toFixed(4)}, {pos.lon.toFixed(4)}. Możesz też kliknąć w mapę, aby zmienić punkt.</p>}
      <form onSubmit={submit} noValidate>
        <div className="grid2">
          <Field id="loc-lat" label="Szerokość (lat)"><input type="text" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} /></Field>
          <Field id="loc-lon" label="Długość (lon)" error={err}><input type="text" inputMode="decimal" value={lon} onChange={(e) => setLon(e.target.value)} /></Field>
        </div>
        <button type="submit">Ustaw współrzędne</button>
      </form>
    </section>
  )
}
