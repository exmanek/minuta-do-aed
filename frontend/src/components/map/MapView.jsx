import { useEffect } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { STATUS } from '../../lib/labels.js'

const PIN = { ok: 'pin-ok', warn: 'pin-warn', bad: 'pin-bad', unk: 'pin-unk' }

function pinIcon(status, selected) {
  const s = STATUS[status?.wartosc] || STATUS.nieznany
  const size = selected ? 38 : 30
  return L.divIcon({
    className: '', iconSize: [size, size], iconAnchor: [size / 2, size],
    html: `<div class="marker-pin ${PIN[s.cls]}" style="width:${size}px;height:${size}px"><span aria-hidden="true">${s.icon}</span></div>`,
  })
}

function Controller({ items, pos, selected }) {
  const map = useMap()
  useEffect(() => { // dopasowanie widoku: do punktów albo do pozycji użytkownika
    if (pos) map.setView([pos.lat, pos.lon], 15)
    else if (items.length) map.fitBounds(L.latLngBounds(items.map((i) => [i.lat, i.lon])).pad(0.2), { maxZoom: 15 })
  }, [map, pos?.lat, pos?.lon, items.length]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { // wybrany punkt: wyśrodkuj
    const it = items.find((i) => i.aed_id === selected)
    if (it) map.panTo([it.lat, it.lon])
  }, [selected]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

function ClickToLocate({ onPick }) {
  useMapEvents({ click: (e) => onPick({ lat: +e.latlng.lat.toFixed(5), lon: +e.latlng.lng.toFixed(5) }) })
  return null
}

export default function MapView({ items, pos, radius, selected, onSelect, onPick }) {
  return (
    <div className="map-box" role="region" aria-label="Mapa punktów AED. Pełna lista punktów jest dostępna w zakładce Lista.">
      <MapContainer center={[52.1, 19.4]} zoom={6} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Controller items={items} pos={pos} selected={selected} />
        <ClickToLocate onPick={onPick} />
        {pos && <>
          <Marker position={[pos.lat, pos.lon]} title="Twoja pozycja" icon={L.divIcon({ className: '', html: '<div style="width:16px;height:16px;border-radius:50%;background:#0b57d0;border:3px solid #fff;box-shadow:0 0 4px #000"></div>', iconSize: [16, 16], iconAnchor: [8, 8] })} />
          <Circle center={[pos.lat, pos.lon]} radius={radius} pathOptions={{ color: '#0b57d0', weight: 1, fillOpacity: 0.05 }} />
        </>}
        {items.map((i) => (
          <Marker key={i.aed_id} position={[i.lat, i.lon]} icon={pinIcon(i.status_dostepnosci, i.aed_id === selected)}
            title={`${i.adres || ''}, ${i.miasto || ''} – ${STATUS[i.status_dostepnosci?.wartosc]?.text || ''}`}
            eventHandlers={{ click: () => onSelect(i.aed_id) }} />
        ))}
      </MapContainer>
    </div>
  )
}
