const GAP = 22      // odstęp kafelka od markera
const MARGIN = 8    // minimalny odstęp od krawędzi mapy
const PIN_H = 42    // wysokość pinezki (kotwica markera jest na jej dole)
const NARROW = 640

const clamp = (v, size, box) => Math.min(Math.max(v, MARGIN), Math.max(MARGIN, box - size - MARGIN))

/**
 * Pozycja kafelka względem markera we współrzędnych kontenera mapy.
 * Szeroki ekran: z prawej strony markera, a gdy tam brakuje miejsca – z lewej. Wąski ekran: nad markerem (lub pod nim).
 * Wynik zawsze mieści się w kontenerze. point = punkt kotwicy markera, size = rozmiar kafelka, box = rozmiar kontenera.
 */
export function placeCallout(point, size, box) {
  const { w, h } = size
  if (box.w < NARROW) {
    const above = point.y - h - PIN_H - MARGIN >= 0
    return { side: above ? 'top' : 'bottom', x: clamp(point.x - w / 2, w, box.w), y: clamp(above ? point.y - h - PIN_H : point.y + GAP / 2, h, box.h) }
  }
  const need = w + GAP + MARGIN
  const spaceR = box.w - point.x, spaceL = point.x
  const side = spaceR >= need ? 'right' : spaceL >= need ? 'left' : spaceR >= spaceL ? 'right' : 'left'
  const x = side === 'right' ? point.x + GAP : point.x - GAP - w
  return { side, x: clamp(x, w, box.w), y: clamp(point.y - PIN_H / 2 - h / 2, h, box.h) }
}
