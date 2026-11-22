import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { AccessibilityProvider } from '../a11y/AccessibilityContext.jsx'
import { buildReport, parseHex, ratio } from '../a11y/contrast.js'
import { applySettings, DEFAULTS, loadSettings } from '../a11y/settings.js'
import AccessibilityMenu from '../components/common/AccessibilityMenu.jsx'
import AccessibilityStatementPage from '../pages/AccessibilityStatementPage.jsx'

const css = (name) => readFileSync(resolve(process.cwd(), 'src/styles', name), 'utf8')
const wrap = (ui) => render(<MemoryRouter><AccessibilityProvider>{ui}</AccessibilityProvider></MemoryRouter>)
const root = document.documentElement

beforeEach(() => { localStorage.clear(); applySettings(DEFAULTS) })

describe('kontrast (WCAG 2.1 AA)', () => {
  it('formuła zgadza się ze znanymi wartościami', () => {
    expect(ratio('#000000', '#ffffff')).toBeCloseTo(21, 1)
    expect(ratio('#777777', '#ffffff')).toBeCloseTo(4.48, 1)
    expect(parseHex('#fff')).toEqual([255, 255, 255]); expect(parseHex('nie-kolor')).toBeNull()
  })
  it('wszystkie sprawdzane pary kolorów spełniają próg w obu motywach', () => {
    const rows = buildReport(css('tokens.css'), css('a11y.css'))
    expect(rows.length).toBeGreaterThan(40)
    const failed = rows.filter((r) => !r.pass).map((r) => `[${r.theme}] ${r.label}: ${r.ratio.toFixed(2)} < ${r.min}`)
    expect(failed).toEqual([])
    expect(new Set(rows.map((r) => r.theme))).toEqual(new Set(['standardowy', 'wysoki kontrast']))
  })
  it('błędny kolor w motywie jest wykrywany jako niespełniający progu', () => {
    const rows = buildReport(css('tokens.css').replace('--muted: #475569', '--muted: #b0b8c4'), css('a11y.css'))
    expect(rows.some((r) => r.theme === 'standardowy' && !r.pass)).toBe(true)
  })
})

describe('menu Dostępność', () => {
  it('otwiera się, zmienia rozmiar tekstu i kontrast, zapamiętuje wybór i przywraca domyślne', () => {
    wrap(<AccessibilityMenu />)
    const toggle = screen.getByRole('button', { name: /Dostępność/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Powiększ tekst' }))
    expect(root.style.fontSize).toBe('115%'); expect(screen.getByText('115%')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Wysoki' }))
    expect(root).toHaveAttribute('data-contrast', 'high'); expect(screen.getByRole('button', { name: 'Wysoki' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByLabelText('Podkreśl linki')); fireEvent.click(screen.getByLabelText('Większe odstępy w tekście'))
    fireEvent.click(screen.getByLabelText('Wyłącz animacje')); fireEvent.click(screen.getByLabelText(/Czcionka systemowa/))
    for (const a of ['data-underline', 'data-spacing', 'data-still', 'data-plain']) expect(root).toHaveAttribute(a)
    expect(loadSettings()).toMatchObject({ size: 1, contrast: 'high', underline: true, spacing: true, still: true, plain: true })
    fireEvent.click(screen.getByRole('button', { name: 'Przywróć domyślne' }))
    expect(root.style.fontSize).toBe('100%'); expect(root).not.toHaveAttribute('data-contrast'); expect(root).not.toHaveAttribute('data-underline')
    expect(loadSettings()).toEqual(DEFAULTS)
  })
  it('rozmiar tekstu ma granice (przyciski wyłączają się na krańcach)', () => {
    wrap(<AccessibilityMenu />)
    fireEvent.click(screen.getByRole('button', { name: /Dostępność/ }))
    expect(screen.getByRole('button', { name: 'Zmniejsz tekst' })).toBeDisabled()
    for (let i = 0; i < 6; i++) if (!screen.getByRole('button', { name: 'Powiększ tekst' }).disabled) fireEvent.click(screen.getByRole('button', { name: 'Powiększ tekst' }))
    expect(root.style.fontSize).toBe('175%'); expect(screen.getByRole('button', { name: 'Powiększ tekst' })).toBeDisabled()
  })
  it('Escape i kliknięcie poza menu zamykają je; fokus wraca na przycisk; jest link do deklaracji', () => {
    wrap(<><AccessibilityMenu /><button type="button">poza</button></>)
    const toggle = screen.getByRole('button', { name: /Dostępność/ })
    fireEvent.click(toggle)
    expect(screen.getByRole('link', { name: 'Deklaracja dostępności' })).toHaveAttribute('href', '/deklaracja-dostepnosci')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('region', { name: 'Ustawienia dostępności' })).toBeNull(); expect(toggle).toHaveFocus()
    fireEvent.click(toggle); fireEvent.mouseDown(screen.getByRole('button', { name: 'poza' }))
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })
  it('uszkodzone dane w localStorage nie psują aplikacji', () => {
    localStorage.setItem('aed_a11y', '{"size": 99, "contrast": "neon"}')
    expect(loadSettings()).toEqual(DEFAULTS)
    localStorage.setItem('aed_a11y', 'nie json'); expect(loadSettings()).toEqual(DEFAULTS)
  })
})

describe('deklaracja dostępności', () => {
  it('zawiera wymagane elementy, liczy kontrast na żywo i nie wymyśla danych kontaktowych', () => {
    wrap(<AccessibilityStatementPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Deklaracja dostępności' })).toBeInTheDocument()
    for (const h of ['Stan dostępności', 'Informacje zwrotne i dane kontaktowe', 'Procedura wnioskowo-skargowa', 'Kontrast kolorów']) expect(screen.getByRole('heading', { name: h })).toBeInTheDocument()
    expect(screen.getByText(/częściowo zgodna/)).toBeInTheDocument()
    expect(screen.getAllByText(/do uzupełnienia/).length).toBeGreaterThanOrEqual(3)
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows).toHaveLength(2); rows.forEach((r) => { const [ok, all] = r.querySelector('td').textContent.split(' / '); expect(ok).toBe(all) })
  })
})
