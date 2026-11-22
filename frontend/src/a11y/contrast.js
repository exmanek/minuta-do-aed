// Kontrast wg WCAG 2.1 (1.4.3 tekst ≥ 4.5:1, 1.4.11 elementy graficzne i kontrolki ≥ 3:1).
export function parseHex(hex) {
  const h = String(hex).trim().replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  if (!/^[0-9a-f]{6}$/i.test(full)) return null
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16))
}

const channel = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
export const luminance = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)

export function ratio(fg, bg) {
  const a = luminance(parseHex(fg)), b = luminance(parseHex(bg))
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

/** Zmienne CSS z bloku o danym selektorze, np. ':root' albo ':root[data-contrast="high"]'. */
export function parseTokens(css, selector) {
  const start = css.indexOf(`${selector} {`)
  if (start < 0) return {}
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start))
  const out = {}
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim()
  return out
}

function resolve(value, tokens, depth = 0) {
  const ref = /^var\((--[\w-]+)\)$/.exec(value || '')
  return ref && depth < 5 ? resolve(tokens[ref[1]], tokens, depth + 1) : value
}
const color = (v, tokens) => (v.startsWith('--') ? resolve(tokens[v], tokens) : v)

const TEXT = 4.5, UI = 3
// [opis, kolor pierwszoplanowy, tło, minimum] – nazwy zaczynające się od „--” to tokeny, reszta to literały z CSS.
const THEME_PAIRS = [
  ['Tekst główny na tle strony', '--text', '--bg', TEXT],
  ['Tekst główny na karcie', '--text', '--surface', TEXT],
  ['Tekst główny na tle pomocniczym', '--text', '--surface-alt', TEXT],
  ['Tekst drugorzędny na tle strony', '--muted', '--bg', TEXT],
  ['Tekst drugorzędny na karcie', '--muted', '--surface', TEXT],
  ['Tekst drugorzędny na tle pomocniczym', '--muted', '--surface-alt', TEXT],
  ['Link na tle strony', '--link', '--bg', TEXT],
  ['Link na karcie', '--link', '--surface', TEXT],
  ['Plakietka „działa”', '--ok', '--ok-bg', TEXT],
  ['Plakietka „w godzinach / ograniczony”', '--warn', '--warn-bg', TEXT],
  ['Plakietka „nie działa”', '--bad', '--bad-bg', TEXT],
  ['Plakietka „brak danych”', '--unk', '--unk-bg', TEXT],
  ['Plakietka informacyjna / aktywna zakładka', '--info', '--info-bg', TEXT],
  ['Aktywny link nawigacji', '--info', '--data-soft', TEXT],
  ['Tekst w polu „Gdzie dokładnie” i zaznaczonej pozycji listy', '--text', '--rescue-soft', TEXT],
  ['Etykieta w polu „Gdzie dokładnie”', '--rescue-dark', '--rescue-soft', TEXT],
  ['Ramka pola formularza na karcie', '--field-border', '--surface', UI],
  ['Wskaźnik fokusu na tle strony', '--focus', '--bg', UI],
  ['Wskaźnik fokusu na karcie', '--focus', '--surface', UI],
]
const NORMAL_ONLY = [
  ['Przycisk główny i „112” (biały tekst)', '#ffffff', '--rescue', TEXT],
  ['Wybrana opcja w menu dostępności', '#ffffff', '--data', TEXT],
]
const HIGH_ONLY = [
  ['Przycisk główny i „112” (czarny tekst)', '#000000', '--rescue', TEXT],
  ['Przycisk zwykły (biały tekst, czarne tło)', '#ffffff', '#000000', TEXT],
  ['Aktywny link nawigacji (czarny na białym)', '#000000', '#ffffff', TEXT],
  ['Wybrana opcja w menu dostępności', '#000000', '--rescue', TEXT],
]
// Pinezki i skupiska na mapie (kolory zapisane w CSS jako literały).
const MAP_PAIRS = [
  ['Pinezka / skupisko „działa” (biały symbol)', '#ffffff', '#15803d', TEXT],
  ['Pinezka / skupisko „w godzinach” (ciemny symbol)', '#422006', '#facc15', TEXT],
  ['Pinezka / skupisko „nie działa” (biały symbol)', '#ffffff', '#dc2626', TEXT],
  ['Pinezka / skupisko „brak danych” (biały symbol)', '#ffffff', '#64748b', TEXT],
]

/** Wylicza wszystkie sprawdzane pary dla trybu standardowego i wysokiego kontrastu. */
export function buildReport(tokensCss, a11yCss) {
  const normal = parseTokens(tokensCss, ':root')
  const high = { ...normal, ...parseTokens(a11yCss, ':root[data-contrast="high"]') }
  const rows = []
  const add = (theme, tokens, pairs) => pairs.forEach(([label, fg, bg, min]) => {
    const f = color(fg, tokens), b = color(bg, tokens)
    const r = f && b && parseHex(f) && parseHex(b) ? ratio(f, b) : NaN
    rows.push({ theme, label, fg: f, bg: b, ratio: r, min, pass: r >= min })
  })
  add('standardowy', normal, [...THEME_PAIRS, ...NORMAL_ONLY, ...MAP_PAIRS])
  add('wysoki kontrast', high, [...THEME_PAIRS, ...HIGH_ONLY, ...MAP_PAIRS])
  return rows
}

export function reportMarkdown(rows, date) {
  const lines = [`# Raport kontrastu (WCAG 2.1 AA) – Minuta do AED`, '', `Wygenerowano: ${date}. Źródło: \`frontend/src/styles/tokens.css\`, \`a11y.css\`. Progi: tekst ≥ 4,5:1, elementy graficzne i kontrolki ≥ 3:1.`, '']
  for (const theme of ['standardowy', 'wysoki kontrast']) {
    const part = rows.filter((r) => r.theme === theme)
    lines.push(`## Motyw: ${theme} (${part.filter((r) => r.pass).length}/${part.length} par spełnia próg)`, '', '| Para | Kolory (tekst / tło) | Kontrast | Wymagane | Wynik |', '| --- | --- | --- | --- | --- |')
    for (const r of part) lines.push(`| ${r.label} | \`${r.fg}\` / \`${r.bg}\` | ${Number.isNaN(r.ratio) ? 'brak' : r.ratio.toFixed(2)}:1 | ${r.min}:1 | ${r.pass ? 'tak' : '**NIE**'} |`)
    lines.push('')
  }
  lines.push('Poza zakresem testu: kafelki mapy OpenStreetMap (nie kontrolujemy ich kolorów), logo (grafika) oraz tekst przeglądarki w polach (np. placeholdery).')
  return lines.join('\n')
}
