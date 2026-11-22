import L from 'leaflet'
import { dominantTone, pinTone } from './labels.js'

export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
export const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
/** Punkt startowy, gdy nie ma lokalizacji użytkownika: centrum Warszawy. */
export const FALLBACK_POS = { lat: 52.2297, lon: 21.0122 }

/** Pinezka AED. Status niesie symbol (✔ ! ✖ ?), a nie tylko kolor. */
export function aedIcon(item, selected) {
  const s = pinTone(item)
  const size = selected ? 42 : 32
  return L.divIcon({
    className: '', iconSize: [size, size], iconAnchor: [size / 2, size],
    html: `<div class="pin pin-${s.cls}${selected ? ' pin-selected' : ''}" style="width:${size}px;height:${size}px"><span aria-hidden="true">${s.icon}</span></div>`,
  })
}

export const userIcon = L.divIcon({ className: '', html: '<div class="user-dot"></div>', iconSize: [20, 20], iconAnchor: [10, 10] })
export const pickIcon = L.divIcon({ className: '', html: '<div class="pin pin-pick" style="width:38px;height:38px"><span aria-hidden="true">+</span></div>', iconSize: [38, 38], iconAnchor: [19, 38] })

/** Ikona skupiska: liczba punktów w okolicy, kolor = przeważający rodzaj punktów w skupisku. */
export function clusterIcon(cluster) {
  const items = cluster.getAllChildMarkers().map((m) => m.options.item)
  const n = items.length
  const size = n < 10 ? 42 : n < 100 ? 50 : 58
  return L.divIcon({
    className: '', iconSize: [size, size],
    html: `<div class="cluster cluster-${dominantTone(items)}" style="width:${size}px;height:${size}px"><span>${n}</span></div>`,
  })
}
