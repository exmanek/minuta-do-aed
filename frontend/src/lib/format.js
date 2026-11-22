export function formatDistance(m) {
  if (m == null) return ''
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`
}
export function formatDate(d) {
  if (!d) return 'brak'
  const x = new Date(d.length === 10 ? `${d}T00:00:00` : d)
  return Number.isNaN(x.getTime()) ? String(d) : x.toLocaleDateString('pl-PL')
}
export const navUrl = (lat, lon) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=walking`
