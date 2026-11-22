import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { TILE_ATTRIBUTION, TILE_URL, userIcon } from '../../lib/mapIcons.js'
import ClusterLayer from './ClusterLayer.jsx'
import { prefersStill } from '../../a11y/settings.js'
import MapCallout from './MapCallout.jsx'

function Controller({ items, pos, locating, selected }) {
  const map = useMap()
  const placed = useRef(false)
  useEffect(() => { // okolica użytkownika (jeśli znamy pozycję) – pozostałe punkty nadal są na mapie
    if (pos) { map.setView([pos.lat, pos.lon], 14); placed.current = true }
  }, [map, pos?.lat, pos?.lon]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { // bez pozycji: widok obejmujący wszystkie punkty (cała Polska)
    if (placed.current || pos || locating || !items.length) return
    map.fitBounds(L.latLngBounds(items.map((i) => [i.lat, i.lon])).pad(0.15), { maxZoom: 14 })
    placed.current = true
  }, [map, pos, locating, items.length]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { // wybór (marker lub lista): płynny przelot do punktu
    const it = items.find((i) => i.aed_id === selected)
    if (!it) return
    const zoom = Math.max(map.getZoom(), 15)
    if (prefersStill()) map.setView([it.lat, it.lon], zoom, { animate: false }); else map.flyTo([it.lat, it.lon], zoom, { duration: 0.6 })
  }, [selected]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

function ClickToDeselect({ onDeselect }) {
  useMapEvents({ click: onDeselect })
  return null
}

/** Mapa wszystkich punktów AED. Kafelek wybranego punktu dostarcza `renderCallout(item)`. */
export default function MapView({ items, pos, locating, selected, onSelect, onDeselect, renderCallout }) {
  const current = items.find((i) => i.aed_id === selected)
  return (
    <div className="map-full" role="region" aria-label="Mapa punktów AED. Lista punktów jest w panelu bocznym.">
      <MapContainer center={[52.1, 19.4]} zoom={6} zoomControl={false} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
        <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL} />
        <Controller items={items} pos={pos} locating={locating} selected={selected} />
        <ClickToDeselect onDeselect={onDeselect} />
        {pos && <Marker position={[pos.lat, pos.lon]} title="Twoja pozycja" icon={userIcon} keyboard={false} />}
        <ClusterLayer items={items} selected={selected} onSelect={onSelect} />
        {current && <MapCallout key={current.aed_id} item={current}>{renderCallout(current)}</MapCallout>}
      </MapContainer>
    </div>
  )
}
