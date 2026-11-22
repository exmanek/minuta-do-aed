import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthContext.jsx'
import { SchemaContext } from '../auth/SchemaContext.jsx'
import MapPage from '../pages/MapPage.jsx'
import StandardPage from '../pages/StandardPage.jsx'
import UploadPanel from '../components/provider/UploadPanel.jsx'
import UrgentPanel from '../components/map/UrgentPanel.jsx'
import ReportDialog from '../components/map/ReportDialog.jsx'
import { schema } from './fixtures.js'

vi.mock('../components/map/MapView.jsx', () => ({ default: () => <div data-testid="map" /> })) // Leaflet wymaga prawdziwej przeglądarki

const item = (id, v, extra = {}) => ({ aed_id: id, lat: 52.2, lon: 21, adres: `ul. ${id}`, miasto: 'Warszawa', lokalizacja_w_obiekcie: 'Hol',
  status_dostepnosci: { wartosc: v, powod: 'test', brakujace: [] }, znacznik_aktualnosci: 'aktualne', dane_przykladowe: true, odleglosc_m: 100, ...extra })
const json = (body, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body), text: () => Promise.resolve('') })
const ctx = { schema: { ...schema, slowniki: { ...schema.slowniki, licencja: ['CC BY 4.0'], prawo_do_udostepniania: ['dane_wlasne'], kompletnosc: [] } }, loading: false, error: null, reload() {} }
const wrap = (ui, path = '/') => render(<MemoryRouter initialEntries={[path]}><AuthProvider><SchemaContext.Provider value={ctx}>{ui}</SchemaContext.Provider></AuthProvider></MemoryRouter>)

let calls
beforeEach(() => { calls = []; vi.stubGlobal('fetch', vi.fn((url, opts) => { calls.push([url, opts]); return json({ items: [item('A', 'dostepny'), item('B', 'nieznany')], liczba: 2 }) })) })
afterEach(() => vi.unstubAllGlobals())

describe('MapPage', () => {
  it('pobiera i pokazuje listę z badge’ami statusu oraz baner danych demo', async () => {
    wrap(<MapPage />)
    expect(await screen.findByText('ul. A, Warszawa')).toBeInTheDocument()
    const list = within(screen.getByRole('list', { name: 'Lista punktów AED' }))
    expect(list.getByText('Dostępny')).toBeInTheDocument()
    expect(list.getByText(/Brak danych o dostępności/)).toBeInTheDocument()
    expect(screen.getByText(/przykładowe i fikcyjne/)).toBeInTheDocument()
    expect(calls[0][0]).toContain('/api/v1/aed?')
  })
  it('filtry trafiają do zapytania API', async () => {
    wrap(<MapPage />, '/?dostepnosc_teraz=true&status=dostepny,nieznany&lat=52.2&lon=21&radius_m=1000')
    await screen.findByText('ul. A, Warszawa')
    const url = calls[0][0]
    expect(url).toContain('dostepnosc_teraz=true'); expect(url).toContain('lat=52.2'); expect(url).toContain('radius_m=1000')
    expect(decodeURIComponent(url)).toContain('status_dostepnosci=dostepny,nieznany'); expect(url).toContain('sort=odleglosc')
  })
  it('pusta lista i błąd API mają czytelne komunikaty', async () => {
    fetch.mockImplementation(() => json({ items: [], liczba: 0 }))
    const { unmount } = wrap(<MapPage />)
    expect(await screen.findByText('Brak punktów AED dla tych filtrów')).toBeInTheDocument()
    unmount()
    fetch.mockImplementation(() => json({ error: { code: 'INTERNAL_ERROR', message: 'Wewnętrzny błąd serwera.', details: [] } }, 500))
    wrap(<MapPage />)
    expect(await screen.findByText(/Nie udało się pobrać danych/)).toBeInTheDocument()
  })
})

describe('UrgentPanel', () => {
  it('niedostępny punkt: ostrzeżenie i propozycja następnego; nieznany opisany jako brak danych', () => {
    const items = [item('A', 'niedostepny'), item('B', 'dostepny', { odleglosc_m: 300 })]
    const onSelect = vi.fn()
    const { unmount } = render(<UrgentPanel aed={items[0]} items={items} onSelect={onSelect} />)
    expect(screen.getByText('Ten punkt jest teraz niedostępny.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Pokaż ten punkt' })); expect(onSelect).toHaveBeenCalledWith('B')
    unmount()
    render(<UrgentPanel aed={item('C', 'nieznany')} items={[]} onSelect={onSelect} />)
    expect(screen.getByText(/nie znaczy, że jest niedostępny/)).toBeInTheDocument()
    expect(screen.queryByText(/jest teraz niedostępny/)).toBeNull()
  })
  it('nic nie pokazuje dla dostępnego punktu', () => {
    const { container } = render(<UrgentPanel aed={item('A', 'dostepny')} items={[]} onSelect={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('ReportDialog', () => {
  it('wymaga typu, wysyła zgłoszenie i potwierdza, że nie zmienia oficjalnych danych; 429 daje komunikat', async () => {
    wrap(<ReportDialog aedId="A" onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Wyślij zgłoszenie' }))
    expect(await screen.findByText('Wybierz rodzaj zgłoszenia.')).toBeInTheDocument()
    fetch.mockImplementation(() => json({ error: { code: 'RATE_LIMITED', message: 'x', details: [] } }, 429))
    fireEvent.change(screen.getByLabelText(/Rodzaj zgłoszenia/), { target: { value: 'uszkodzone' } })
    fireEvent.click(screen.getByRole('button', { name: 'Wyślij zgłoszenie' }))
    expect(await screen.findByText(/Zbyt wiele zgłoszeń/)).toBeInTheDocument()
    fetch.mockImplementation(() => json({ id: 'r_1' }, 201))
    fireEvent.click(screen.getByRole('button', { name: 'Wyślij zgłoszenie' }))
    expect(await screen.findByText(/Zgłoszenie zapisano jako uwagę społeczności/)).toBeInTheDocument()
    const post = fetch.mock.calls.at(-1)
    expect(post[0]).toBe('/api/v1/aed/A/reports'); expect(JSON.parse(post[1].body)).toEqual({ typ: 'uszkodzone' })
  })
})

describe('UploadPanel', () => {
  it('odrzuca PDF/DOC po stronie klienta, przyjmuje CSV i pokazuje formularz źródła', async () => {
    wrap(<UploadPanel onCreated={() => {}} />)
    const input = screen.getByLabelText('Wybierz pliki danych')
    fireEvent.change(input, { target: { files: [new File(['x'], 'raport.pdf'), new File(['a;b'], 'demo.csv')] } })
    expect(await screen.findByText(/raport\.pdf: PDF nie jest dopuszczalnym formatem danych/)).toBeInTheDocument()
    expect(screen.getByText(/Źródło 1: demo\.csv/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Wczytaj i zaproponuj mapowanie/ }))
    expect(await screen.findAllByText(/Wybierz licencję|Podaj podmiot zarządzający/)).not.toHaveLength(0)
    expect(calls.length).toBe(0) // walidacja klientowa zatrzymuje wysyłkę
  })
})

describe('StandardPage', () => {
  it('pokazuje pola ze schematu i link do wzorca XLSX', () => {
    wrap(<StandardPage />)
    expect(screen.getByRole('link', { name: /Pobierz wzorzec XLSX/ })).toHaveAttribute('href', '/api/v1/standard/template.xlsx')
    expect(screen.getAllByText('Szerokość geograficzna')[0]).toBeInTheDocument()
    expect(screen.getByText(/Publikację w dane.gov.pl wykonujesz samodzielnie/)).toBeInTheDocument()
  })
})
