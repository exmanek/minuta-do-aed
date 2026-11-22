const R = 6371008.8

/** Odległość w metrach (haversine). */
export function distanceM(a, b) {
  const rad = (d) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Odległość jest wyłącznie informacją i kolejnością listy – nigdy nie wycina punktów. Bez pozycji lista zostaje bez zmian. */
export function byDistance(items, pos) {
  if (!pos) return items
  return items.map((i) => ({ ...i, odleglosc_m: Math.round(distanceM(pos, i)) })).sort((x, y) => x.odleglosc_m - y.odleglosc_m)
}

const norm = (s) => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/** Wyszukiwarka listy: adres, miasto, miejsce w obiekcie, identyfikator, dysponent. */
export function matchesQuery(item, query) {
  const q = norm(query).trim()
  if (!q) return true
  const hay = norm([item.adres, item.miasto, item.lokalizacja_w_obiekcie, item.aed_id, item.dysponent_nazwa].join(' '))
  return q.split(/\s+/).every((t) => hay.includes(t))
}
