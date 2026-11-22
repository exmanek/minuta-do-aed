import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { useEffect } from 'react'

const icon = L.divIcon({ className: '', html: '<div class="marker-pin pin-ok" style="width:30px;height:30px"><span>+</span></div>', iconSize: [30, 30], iconAnchor: [15, 30] })

function Clicker({ onPick }) { useMapEvents({ click: (e) => onPick(+e.latlng.lat.toFixed(6), +e.latlng.lng.toFixed(6)) }); return null }
function Recenter({ pos }) { const map = useMap(); useEffect(() => { if (pos) map.setView(pos, Math.max(map.getZoom(), 15)) }, [pos?.[0], pos?.[1]]); return null } // eslint-disable-line

/** Mini-mapa do wskazania współrzędnych kliknięciem (alternatywa dla ręcznego wpisania lat/lon). */
export default function CoordPicker({ lat, lon, onPick }) {
  const la = Number(String(lat).replace(',', '.')), lo = Number(String(lon).replace(',', '.'))
  const pos = lat !== '' && lon !== '' && !Number.isNaN(la) && !Number.isNaN(lo) ? [la, lo] : null
  return (
    <div style={{ height: 260, margin: '8px 0' }} className="map-box" role="group" aria-label="Wybierz położenie na mapie (alternatywa dla wpisania współrzędnych)">
      <MapContainer center={pos || [52.1, 19.4]} zoom={pos ? 15 : 6} style={{ height: '100%', width: '100%' }}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Clicker onPick={onPick} /><Recenter pos={pos} />
        {pos && <Marker position={pos} icon={icon} />}
      </MapContainer>
    </div>
  )
}
