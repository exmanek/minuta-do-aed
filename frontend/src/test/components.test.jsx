import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Field from '../components/common/Field.jsx'
import { FreshnessBadge, StatusBadge } from '../components/common/StatusBadge.jsx'
import MappingTable from '../components/provider/MappingTable.jsx'
import { schema } from './fixtures.js'

vi.mock('../api/provider.js', () => ({
  validateAed: vi.fn(() => Promise.resolve({ problemy: [], mozna_zapisac: true })),
  createAed: vi.fn(), updateAed: vi.fn(), login: vi.fn(),
}))
vi.mock('../api/standard.js', () => ({
  getDeclarations: vi.fn(() => Promise.resolve({ wersja: 'v1', robocza: true, oswiadczenia: [
    { typ: 'prawdziwosc', wymagane: true, tresc: 'Oświadczam prawdziwość.', tresc_hash: 'a' },
    { typ: 'prawo_do_udostepniania', wymagane: true, tresc: 'Oświadczam prawo.', tresc_hash: 'b' },
    { typ: 'aktualnosc', wymagane: false, tresc: 'Potwierdzam aktualność.', tresc_hash: 'c' }] })),
  getSchema: vi.fn(), templateUrl: '/x',
}))
import * as providerApi from '../api/provider.js'
import { SchemaContext } from '../auth/SchemaContext.jsx'
import { AuthProvider } from '../auth/AuthContext.jsx'
import AedForm from '../components/provider/AedForm.jsx'
import RegonLogin from '../components/provider/RegonLogin.jsx'

const wrap = (ui) => render(
  <MemoryRouter><AuthProvider><SchemaContext.Provider value={{ schema, loading: false, error: null, reload() {} }}>{ui}</SchemaContext.Provider></AuthProvider></MemoryRouter>)

beforeEach(() => vi.clearAllMocks())

describe('wspólne', () => {
  it('Field łączy etykietę, opis i błąd z kontrolką', () => {
    render(<Field id="x" label="Adres" hint="Podpowiedź" error="Błąd!" required><input type="text" /></Field>)
    const input = screen.getByLabelText(/Adres/)
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input.getAttribute('aria-describedby')).toContain('x-err')
    expect(screen.getByRole('alert')).toHaveTextContent('Błąd!')
  })
  it('StatusBadge pokazuje tekst, nie tylko kolor; „nieznany” = brak danych', () => {
    render(<><StatusBadge status={{ wartosc: 'nieznany', powod: 'x' }} /><StatusBadge status={{ wartosc: 'niedostepny' }} /><FreshnessBadge value="do_odswiezenia" /></>)
    expect(screen.getByText(/Brak danych o dostępności/)).toBeInTheDocument()
    expect(screen.getByText(/Niedostępny/)).toBeInTheDocument()
    expect(screen.getByText(/Do odświeżenia/)).toBeInTheDocument()
  })
})

describe('MappingTable', () => {
  const source = { zrodlo_id: 's1', nazwa: 'Demo', nazwa_pliku: 'd.csv', format: 'csv', kodowanie: 'utf-8', separator: ';', liczba_wierszy: 2,
    kontrola_naglowkow: { brakujace: ['stan'], nadmiarowe: ['x'], powtorzone: [] },
    proponowane_mapowanie: [{ kolumna: 'a', pole: 'lat', pewnosc: 'wysoka' }, { kolumna: 'b', pole: null, pewnosc: 'brak' }] }
  it('blokuje pole już zmapowane w innej kolumnie i zgłasza zmiany', () => {
    const onChange = vi.fn()
    render(<MappingTable source={source} fields={schema.pola} value={{ a: 'lat', b: null }} onChange={onChange} />)
    const selB = screen.getByLabelText('b')
    expect(selB.querySelector('option[value="lat"]')).toBeDisabled()
    fireEvent.change(selB, { target: { value: 'lon' } })
    expect(onChange).toHaveBeenCalledWith({ a: 'lat', b: 'lon' })
    expect(screen.getByText(/Brakujące pola wymagane/)).toHaveTextContent('stan')
  })
})

describe('RegonLogin', () => {
  it('niepoprawny format REGON: komunikat bez zapytania do API', async () => {
    wrap(<RegonLogin />)
    fireEvent.change(screen.getByLabelText(/REGON dostawcy/), { target: { value: '123456789' } })
    fireEvent.change(screen.getByLabelText('Hasło'), { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: 'Zaloguj' }))
    expect(await screen.findByText(/niepoprawny format/i)).toBeInTheDocument()
    expect(providerApi.login).not.toHaveBeenCalled()
  })
  it('nie pisze, że REGON jest „zweryfikowany”', () => {
    wrap(<RegonLogin />)
    expect(document.body.textContent).not.toMatch(/REGON zweryfikowany|potwierdzono podmiot/i)
  })
})

describe('AedForm (generowany ze schematu)', () => {
  it('buduje pola ze schematu, ukrywa pola systemowe, aktywuje godziny dla w_godzinach, blokuje zapis bez oświadczeń', async () => {
    wrap(<AedForm />)
    expect(screen.getByLabelText(/Nowe pole z wzorca/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Identyfikator AED/)).toBeNull()
    expect(screen.queryByLabelText(/^Dostawca/)).toBeNull()
    expect(screen.getByLabelText(/Godziny dostępu/)).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/Godziny dostępności/), { target: { value: 'w_godzinach' } })
    expect(screen.getByLabelText(/Godziny dostępu/)).not.toBeDisabled()
    const submit = screen.getByRole('button', { name: 'Dodaj punkt' })
    expect(submit).toBeDisabled()
    fireEvent.click(await screen.findByLabelText(/Oświadczam prawdziwość/))
    expect(submit).toBeDisabled()
    fireEvent.click(screen.getByLabelText(/Oświadczam prawo/))
    expect(submit).not.toBeDisabled()
  })
  it('współrzędne: mapa z GPS jako główny sposób, ręczne pola tylko w zwijanej sekcji', async () => {
    wrap(<AedForm />)
    await screen.findByLabelText(/Oświadczam prawdziwość/)
    expect(screen.getByRole('group', { name: /Mapa do wskazania położenia/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Użyj mojej lokalizacji' })).toBeInTheDocument()
    const manual = screen.getByText('Pokaż/edytuj współrzędne ręcznie').closest('details')
    expect(manual).not.toHaveAttribute('open')
    expect(manual).toContainElement(screen.getByLabelText(/Szerokość geograficzna/))
    expect(manual).toContainElement(screen.getByLabelText(/Długość geograficzna/))
  })
  it('GPS ustawia pozycję w formularzu bez wpisywania; domyślnie brak danych = „nieznane”', async () => {
    vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition: (ok) => ok({ coords: { latitude: 50.0614, longitude: 19.9372 } }) } })
    wrap(<AedForm />)
    await waitFor(() => expect(screen.getByLabelText(/Szerokość geograficzna/)).toHaveValue('50.0614'))
    expect(screen.getByLabelText(/Długość geograficzna/)).toHaveValue('19.9372')
    expect(screen.getByLabelText(/Godziny dostępności/)).toHaveValue('nieznana')
    expect(screen.getByLabelText(/Stan urządzenia/)).toHaveValue('nieznany')
    vi.unstubAllGlobals()
  })
  it('wysyła payload bez pustych pól i mapuje błędy API na pola', async () => {
    providerApi.createAed.mockRejectedValue(Object.assign(new Error('Rekord zawiera błędy blokujące.'),
      { code: 'VALIDATION_BLOCKING', details: [{ pole: 'lat', komunikat: 'Brak współrzędnych.', regula: 'AED-REQ-001' }] }))
    wrap(<AedForm />)
    fireEvent.change(screen.getByLabelText(/Adres/), { target: { value: 'ul. Test 1' } })
    fireEvent.click(await screen.findByLabelText(/Oświadczam prawdziwość/)); fireEvent.click(screen.getByLabelText(/Oświadczam prawo/))
    fireEvent.click(screen.getByLabelText(/Potwierdzam, że dane/))
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj punkt' }))
    await waitFor(() => expect(providerApi.createAed).toHaveBeenCalled())
    const body = providerApi.createAed.mock.calls[0][0]
    expect(body).toMatchObject({ adres: 'ul. Test 1', oswiadczenie_prawdziwosci: true, oswiadczenie_prawa_do_udostepniania: true, potwierdzam_aktualnosc: true, wersja_tresci: 'v1' })
    expect(body).not.toHaveProperty('lat')
    expect(await screen.findAllByText('Brak współrzędnych.')).not.toHaveLength(0)
    expect(screen.getByText('Pokaż/edytuj współrzędne ręcznie').closest('details')).toHaveAttribute('open') // błąd otwiera sekcję
    expect(screen.getByLabelText(/Szerokość geograficzna/)).toHaveAttribute('aria-invalid', 'true')
  })
  it('walidacja na żywo pokazuje błąd i ostrzeżenie przy polu', async () => {
    providerApi.validateAed.mockResolvedValue({ mozna_zapisac: false, problemy: [
      { pole: 'lat', poziom: 'blad', komunikat: 'Współrzędna lat nie jest liczbą.', regula: 'AED-COORD-001' },
      { pole: 'stan', poziom: 'ostrzezenie', komunikat: 'Brak informacji o stanie.', regula: 'AED-AVAIL-002' }] })
    wrap(<AedForm />)
    fireEvent.change(screen.getByLabelText(/Szerokość geograficzna/), { target: { value: 'abc' } })
    expect(await screen.findByText('Współrzędna lat nie jest liczbą.', {}, { timeout: 2000 })).toBeInTheDocument()
    expect(screen.getByText('Brak informacji o stanie.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dodaj punkt' })).toBeDisabled()
  })
})
