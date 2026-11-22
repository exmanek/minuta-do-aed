// Ustawienia dostępności użytkownika (menu „Dostępność”). Zapamiętywane w localStorage i nakładane na <html>.
export const FONT_SCALES = [100, 115, 130, 150, 175] // % bazowego rozmiaru czcionki
export const DEFAULTS = { size: 0, contrast: 'normal', underline: false, spacing: false, still: false, plain: false }
const KEY = 'aed_a11y'

export function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}')
    return {
      size: Number.isInteger(s.size) && s.size >= 0 && s.size < FONT_SCALES.length ? s.size : DEFAULTS.size,
      contrast: s.contrast === 'high' ? 'high' : 'normal',
      underline: s.underline === true, spacing: s.spacing === true, still: s.still === true, plain: s.plain === true,
    }
  } catch { return { ...DEFAULTS } }
}

export function saveSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* tryb prywatny: ustawienia działają do końca sesji */ }
}

/** Nakłada ustawienia na element <html>: rozmiar czcionki oraz atrybuty data-* używane przez a11y.css. */
export function applySettings(s, root = document.documentElement) {
  root.style.fontSize = `${FONT_SCALES[s.size]}%`
  const flag = (name, on) => (on ? root.setAttribute(`data-${name}`, '1') : root.removeAttribute(`data-${name}`))
  if (s.contrast === 'high') root.setAttribute('data-contrast', 'high'); else root.removeAttribute('data-contrast')
  flag('underline', s.underline); flag('spacing', s.spacing); flag('still', s.still); flag('plain', s.plain)
}

/** Czy ograniczyć animacje (ustawienie użytkownika albo preferencja systemu). */
export const prefersStill = () =>
  document.documentElement.hasAttribute('data-still') || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
