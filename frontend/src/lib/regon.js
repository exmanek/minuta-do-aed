// Tylko PODPOWIEDŹ formatu po stronie klienta (długość + suma kontrolna). Rozstrzyga backend. Nie potwierdza tożsamości podmiotu.
const W9 = [8, 9, 2, 3, 4, 5, 6, 7]
const W14 = [2, 4, 8, 5, 0, 9, 7, 3, 6, 1, 2, 4, 8]
export function isValidRegonFormat(r) {
  if (typeof r !== 'string' || !/^\d+$/.test(r) || ![9, 14].includes(r.length)) return false
  const d = [...r].map(Number)
  const s9 = (d.slice(0, 8).reduce((a, x, i) => a + x * W9[i], 0) % 11) % 10
  if (d[8] !== s9) return false
  if (r.length === 14) return d[13] === (d.slice(0, 13).reduce((a, x, i) => a + x * W14[i], 0) % 11) % 10
  return true
}
