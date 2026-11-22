import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthContext.jsx'
import { SchemaContext } from '../auth/SchemaContext.jsx'
import { listAllAed } from '../api/aed.js'
import MapPage from '../pages/MapPage.jsx'
import StandardPage from '../pages/StandardPage.jsx'
import UploadPanel from '../components/provider/UploadPanel.jsx'
import UrgentPanel from '../components/map/UrgentPanel.jsx'
import ReportDialog from '../components/map/ReportDialog.jsx'
import { schema } from './fixtures.js'

// Leaflet wymaga prawdziwej przeglądarki: mock pokazuje liczbę markerów i kafelek wybranego punktu (jak MapCallout)
vi.mock('../components/map/MapView.jsx', () => ({ default: ({ items, selected, renderCallout }) => (
  <div data-testid="map" data-count={items.length}>{items.filter((i) => i.aed_id === selected).map((i) => <div key={i.aed_id} data-testid="callout">{renderCallout(i)}</div>)}</div>) }))

const item = (id, v, extra = {}) => ({ aed_id: id, lat: 52.2, lon: 21, adres: `ul. ${id}`, miasto: 'Warszawa', lokalizacja_w_obiekcie: 'Hol',
  status_dostepnosci: { wartosc: v, powod: 'test', brakujace: [] }, znacznik_aktualnosci: 'aktualne', dane_przykladowe: true, odleglosc_m: 100, ...extra })
const json = (body, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body), text: () => Promise.resolve('') })
const ctx = { schema: { ...schema, slowniki: { ...schema.slowniki, licencja: ['CC BY 4.0'], prawo_do_udostepniania: ['dane_wlasne'], kompletnosc: [] } }, loading: false, error: null, reload() {} }
const wrap = (ui, path = '/') => render(<MemoryRouter initialEntries={[path]}><AuthProvider><SchemaContext.Provider value={ctx}>{ui}</SchemaContext.Provider></AuthProvider></MemoryRouter>)

let calls
beforeEach(() => { calls = []; vi.stubGlobal('fetch', vi.fn((url, opts) => { calls.push([url, opts]); return json({ items: [item('A', 'dostepny'), item('B', 'nieznany')], liczba: 2 }) })) })
afterEach(() => vi.unstubAllGlobals())

const full = (id, v, extra = {}) => item(id, v, { nazwa_dostawcy: 'Dostawca Demo', regon_dostawcy: '123456785', stan: 'nieznany', bariera_dostepu: 'nieznana',
  dostepnosc: 'nieznana', ograniczenia_dostepu: 'nieznane', lokalizacja_w_obiekcie: 'Hol główny przy windzie', ...extra })
const geo = (impl) => vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition: impl } })

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
  it('filtry trafiają do zapytania API, ale nigdy promień ani pozycja – punkty nie są wycinane', async () => {
    wrap(<MapPage />, '/?dostepnosc_teraz=true&status=dostepny,nieznany&lat=52.2&lon=21')
    await screen.findByText('ul. A, Warszawa')
    const url = decodeURIComponent(calls[0][0])
    expect(url).toContain('dostepnosc_teraz=true'); expect(url).toContain('status_dostepnosci=dostepny,nieznany')
    for (const forbidden of ['radius_m', 'lat=', 'lon=', 'sort=']) expect(url).not.toContain(forbidden)
  })
  it('wszystkie punkty są na mapie i liście także daleko od użytkownika; odległość jest tylko informacją i kolejnością', async () => {
    fetch.mockImplementation(() => json({ liczba: 3, items: [item('KRK', 'dostepny', { lat: 50.06, lon: 19.94, adres: 'Rynek 1', miasto: 'Kraków' }),
      item('WAW', 'dostepny'), item('GDA', 'nieznany', { lat: 54.35, lon: 18.65, adres: 'Długa 1', miasto: 'Gdańsk' })] }))
    wrap(<MapPage />, '/?lat=52.2&lon=21')
    await screen.findByText('ul. WAW, Warszawa')
    expect(screen.getByTestId('map')).toHaveAttribute('data-count', '3')
    const rows = within(screen.getByRole('list', { name: 'Lista punktów AED' })).getAllByRole('button')
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveTextContent('ul. WAW'); expect(rows[0]).toHaveTextContent('0 m'); expect(rows[2]).toHaveTextContent(/km/)
    expect(screen.getByText('3')).toBeInTheDocument() // licznik w panelu
  })
  it('bez zgody na lokalizację: komunikat, brak pól na współrzędne, mapa nadal pokazuje wszystkie punkty', async () => {
    geo((_ok, fail) => fail({ code: 1 }))
    wrap(<MapPage />)
    expect(await screen.findByText(/Brak zgody na lokalizację/)).toBeInTheDocument()
    expect(screen.getByText(/Lokalizacja niedostępna/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Szerokość|Długość/)).toBeNull()
    await screen.findByText('ul. A, Warszawa')
    expect(screen.getByTestId('map')).toHaveAttribute('data-count', '2')
  })
  it('GPS jest pobierany od razu, ale nie trafia do zapytania ani do adresu URL', async () => {
    geo((ok) => ok({ coords: { latitude: 50.06, longitude: 19.94 } }))
    wrap(<MapPage />)
    await screen.findByText('ul. A, Warszawa')
    expect(calls[0][0]).not.toContain('50.06'); expect(screen.getByText('Twoja lokalizacja (GPS)')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Lista punktów AED' })).getAllByText(/km/)).toHaveLength(2)
  })
  it('wyszukiwarka zawęża listę (licznik „1 z 2”), ale markery na mapie zostają', async () => {
    wrap(<MapPage />)
    await screen.findByText('ul. A, Warszawa')
    fireEvent.change(screen.getByLabelText(/Szukaj punktu/), { target: { value: 'ul. B' } })
    const list = within(screen.getByRole('list', { name: 'Lista punktów AED' }))
    expect(list.queryByText('ul. A, Warszawa')).toBeNull(); expect(list.getByText('ul. B, Warszawa')).toBeInTheDocument()
    expect(screen.getByText(/z 2/)).toBeInTheDocument()
    expect(screen.getByTestId('map')).toHaveAttribute('data-count', '2')
  })
  it('panel listy można ukryć i pokazać, licznik zostaje na przycisku', async () => {
    wrap(<MapPage />)
    await screen.findByText('ul. A, Warszawa')
    fireEvent.click(screen.getByRole('button', { name: 'Ukryj listę punktów' }))
    expect(screen.queryByRole('list', { name: 'Lista punktów AED' })).toBeNull()
    const fab = screen.getByRole('button', { name: /Lista AED/ })
    expect(fab).toHaveTextContent('2')
    fireEvent.click(fab)
    expect(screen.getByRole('list', { name: 'Lista punktów AED' })).toBeInTheDocument()
  })
  it('wybór punktu otwiera kafelek (miejsce w obiekcie, 4 aspekty, akcje) bez banera; × i Escape zamykają; brak danych jest neutralny', async () => {
    fetch.mockImplementation((url) => json(String(url).includes('/aed/A') ? full('A', 'nieznany') : { items: [item('A', 'nieznany'), item('B', 'dostepny')], liczba: 2 }))
    wrap(<MapPage />)
    fireEvent.click(await screen.findByRole('button', { name: /ul\. A/ }))
    const card = within(await screen.findByTestId('callout'))
    expect(await card.findByText('Hol główny przy windzie')).toBeInTheDocument()
    for (const label of ['Godziny', 'Dostęp do urządzenia', 'Ograniczenia', 'Stan urządzenia']) expect(card.getByText(label)).toBeInTheDocument()
    expect(card.getByRole('link', { name: 'Nawiguj' })).toBeInTheDocument()
    expect(card.getByRole('button', { name: 'Szczegóły' })).toBeInTheDocument(); expect(card.getByRole('button', { name: 'Zgłoś z terenu' })).toBeInTheDocument()
    const pills = screen.getByTestId('callout').querySelectorAll('.aspects .badge')
    expect(pills).toHaveLength(4); pills.forEach((p) => { expect(p).toHaveClass('unk'); expect(p).not.toHaveClass('bad') })
    expect(screen.getByTestId('callout').querySelector('.alert.bad')).toBeNull()
    fireEvent.click(card.getByRole('button', { name: 'Szczegóły' })); expect(card.getByText('Współrzędne')).toBeInTheDocument()
    fireEvent.click(card.getByRole('button', { name: 'Zamknij kafelek punktu' }))
    expect(screen.queryByTestId('callout')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /ul\. A/ })); await screen.findByTestId('callout')
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByTestId('callout')).toBeNull())
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

describe('listAllAed', () => {
  it('pobiera kolejne strony, aż do wszystkich punktów (backend daje maks. 200 na stronę)', async () => {
    const mk = (n, from) => Array.from({ length: n }, (_, i) => item(`P${from + i}`, 'nieznany'))
    fetch.mockImplementation((url) => json(String(url).includes('offset=200') ? { items: mk(50, 200), liczba: 250 } : { items: mk(200, 0), liczba: 250 }))
    const r = await listAllAed({})
    expect(r.items).toHaveLength(250); expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls[0][0]).toContain('limit=200'); expect(fetch.mock.calls[1][0]).toContain('offset=200')
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
