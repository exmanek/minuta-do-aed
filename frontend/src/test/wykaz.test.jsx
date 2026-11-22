import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthContext.jsx'
import WykazPage from '../pages/WykazPage.jsx'

const kolumny = [{ nazwa: 'aed_id', etykieta: 'Identyfikator' }, { nazwa: 'adres', etykieta: 'Adres' }, { nazwa: 'miasto', etykieta: 'Miasto' },
  { nazwa: 'lokalizacja_w_obiekcie', etykieta: 'Gdzie dokładnie' }, { nazwa: 'stan', etykieta: 'Stan urządzenia' }, { nazwa: 'lat', etykieta: 'Szerokość' }]
const row = (i, extra = {}) => ({ aed_id: `AED-${i}`, adres: `ul. Test ${i}`, miasto: 'Krosno', lokalizacja_w_obiekcie: 'Hol', stan: 'nieznany', lat: 49 + i / 10, ...extra })
const rows = [row(3, { miasto: 'Zabrze', lat: 50.3 }), row(1, { lat: 49.1 }), row(2, { miasto: 'Łódź', stan: 'sprawny', lat: 51.8 })]
const body = { kolumny, items: rows, liczba: 3, dane_przykladowe: true, data_wygenerowania: '2026-11-22T10:00:00+01:00' }

beforeEach(() => vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve('') }))))
afterEach(() => vi.unstubAllGlobals())
const wrap = () => render(<MemoryRouter><AuthProvider><WykazPage /></AuthProvider></MemoryRouter>)

describe('Wykaz AED', () => {
  it('pokazuje kolumny z backendu, pliki do pobrania i uczciwą informację, że to nie publikacja', async () => {
    wrap()
    await screen.findByText('ul. Test 1')
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent.replace(/[▲▼↕\s]+$/, ''))).toEqual(kolumny.map((c) => c.etykieta))
    expect(screen.getByRole('link', { name: 'Pobierz CSV' })).toHaveAttribute('href', '/api/v1/export/wykaz.csv')
    expect(screen.getByRole('link', { name: /Metryczka zbioru \(XML\)/ })).toHaveAttribute('href', '/api/v1/export/metadata.xml')
    expect(screen.getByText(/nie jest publikacją w dane.gov.pl/)).toBeInTheDocument()
    expect(screen.getByText(/przykładowe i fikcyjne/)).toBeInTheDocument()
    expect(screen.getAllByText(/Nieznany \(brak danych\)/).length).toBeGreaterThan(0)
  })
  it('sortuje po kolumnie (tekst i liczby) z aria-sort', async () => {
    wrap()
    await screen.findByText('ul. Test 1')
    const ids = () => within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row').map((r) => within(r).getAllByRole('cell')[0].textContent)
    fireEvent.click(screen.getByRole('button', { name: /Szerokość/ }))
    expect(ids()).toEqual(['AED-1', 'AED-3', 'AED-2'])
    expect(screen.getByRole('columnheader', { name: /Szerokość/ })).toHaveAttribute('aria-sort', 'ascending')
    fireEvent.click(screen.getByRole('button', { name: /Szerokość/ }))
    expect(ids()).toEqual(['AED-2', 'AED-3', 'AED-1'])
    fireEvent.click(screen.getByRole('button', { name: /Miasto/ }))
    expect(ids()[0]).toBe('AED-1') // Krosno przed Łódź i Zabrze
  })
  it('wyszukuje bez rozróżniania wielkości liter, stronicuje i liczy wiersze', async () => {
    wrap()
    await screen.findByText('ul. Test 1')
    fireEvent.change(screen.getByLabelText('Szukaj w tabeli'), { target: { value: 'ŁÓDŹ' } })
    expect(screen.getByText('ul. Test 2')).toBeInTheDocument(); expect(screen.queryByText('ul. Test 1')).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('Wierszy: 1 z 3')
    fireEvent.change(screen.getByLabelText('Szukaj w tabeli'), { target: { value: 'brak-takiego' } })
    expect(screen.getByText(/Brak wierszy/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Szukaj w tabeli'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Wierszy na stronie'), { target: { value: '10' } })
    expect(screen.getByRole('button', { name: 'Następna' })).toBeDisabled(); expect(screen.getByRole('button', { name: 'Poprzednia' })).toBeDisabled()
  })
})
