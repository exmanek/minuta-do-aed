import { useEffect } from 'react'
import 'leaflet/dist/leaflet.css'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { useGeolocation } from '../../hooks/useGeolocation.js'
import { FALLBACK_POS, pickIcon, TILE_ATTRIBUTION, TILE_URL } from '../../lib/mapIcons.js'

const round = (n) => +Number(n).toFixed(6)

function Clicker({ onPick }) { useMapEvents({ click: (e) => onPick(round(e.latlng.lat), round(e.latlng.lng)) }); return null }
function Recenter({ pos }) {
  const map = useMap()
  useEffect(() => { if (pos) map.setView(pos, Math.max(map.getZoom(), 16)) }, [pos?.[0], pos?.[1]]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

/**
 * Wskazanie położenia urządzenia bez wpisywania współrzędnych: GPS (automatycznie dla nowego punktu),
 * kliknięcie w mapę albo przeciągnięcie pinezki. Wartości lat/lon trafiają do formularza przez onChange.
 */
export default function PositionPicker({ lat, lon, onChange, auto }) {
  const geo = useGeolocation(auto)
  useEffect(() => { if (geo.pos) onChange(round(geo.pos.lat), round(geo.pos.lon)) }, [geo.pos]) // eslint-disable-line react-hooks/exhaustive-deps
  const la = Number(String(lat).replace(',', '.')), lo = Number(String(lon).replace(',', '.'))
  const pos = lat !== '' && lon !== '' && Number.isFinite(la) && Number.isFinite(lo) ? [la, lo] : null
  return (
    <div className="position-picker">
      <div className="position-bar" role="status" aria-live="polite">
        <p>{geo.loading ? 'Ustalanie pozycji z GPS…' : pos ? <>Pozycja ustawiona: <span className="mono">{la.toFixed(5)}, {lo.toFixed(5)}</span></> : 'Wskaż miejsce na mapie albo użyj GPS.'}</p>
        <button type="button" onClick={geo.locate} disabled={geo.loading}>Użyj mojej lokalizacji</button>
      </div>
      {geo.error && <p className="small muted">{geo.error} Kliknij w mapę, aby ustawić pozycję.</p>}
      <div className="position-map" role="group" aria-label="Mapa do wskazania położenia urządzenia. Kliknij lub przeciągnij pinezkę.">
        <MapContainer center={pos || [FALLBACK_POS.lat, FALLBACK_POS.lon]} zoom={pos ? 16 : 12} style={{ height: '100%', width: '100%' }}>
          <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL} />
          <Clicker onPick={onChange} /><Recenter pos={pos} />
          {pos && <Marker position={pos} icon={pickIcon} draggable keyboard={false}
            eventHandlers={{ dragend: (e) => { const p = e.target.getLatLng(); onChange(round(p.lat), round(p.lng)) } }} />}
        </MapContainer>
      </div>
    </div>
  )
}
