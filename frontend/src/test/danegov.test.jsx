import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MappingTable from '../components/provider/MappingTable.jsx'
import { schema } from './fixtures.js'

vi.mock('../api/danegov.js', () => ({ getCatalog: vi.fn(), importFromDanegov: vi.fn() }))
import * as api from '../api/danegov.js'
import DanegovImport from '../components/provider/DanegovImport.jsx'

const item = (id, over = {}) => ({ dataset_id: id, tytul: `Zbiór ${id}`, strona_url: `https://dane.gov.pl/pl/dataset/${id}`, wydawca: { nazwa: 'Urząd Miasta X', regon: '000526989' },
  licencja: 'CC0 1.0', aktualizacja: 'Nieregularnie', zasob: { id: '1', format: 'csv', data: '2025-01-01' }, mozna_importowac: true, powod_pominiecia: null, ...over })
const catalog = { items: [item('1'), item('2', { licencja: 'CC BY 4.0' }), item('3', { mozna_importowac: false, zasob: null, powod_pominiecia: 'Zasób jest linkiem do strony zewnętrznego wydawcy.' })],
  pobrano: '2026-11-22T10:00:00+01:00', zrodlo: 'https://api.dane.gov.pl/1.4' }

beforeEach(() => { vi.clearAllMocks(); api.getCatalog.mockResolvedValue(catalog) })

describe('DanegovImport', () => {
  it('pokazuje katalog, zaznacza importowalne, blokuje pominięte i podaje powód', async () => {
    render(<DanegovImport onCreated={() => {}} />)
    expect(await screen.findByText('Zbiór 1')).toBeInTheDocument()
    expect(screen.getByLabelText('Importuj: Zbiór 1')).toBeChecked()
    expect(screen.getByLabelText('Importuj: Zbiór 3')).toBeDisabled()
    expect(screen.getByText(/linkiem do strony zewnętrznego wydawcy/)).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'CC BY 4.0' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Importuj wybrane zbiory (2)' })).toBeEnabled()
    expect(screen.getByText(/nie zawierają dostępności ani stanu/)).toBeInTheDocument()
    expect(api.getCatalog).toHaveBeenCalledWith(false)
  })
  it('importuje tylko zaznaczone i przekazuje utworzoną partię', async () => {
    const batch = { batch_id: 'b_1', pominiete: [] }
    api.importFromDanegov.mockResolvedValue(batch)
    const onCreated = vi.fn()
    render(<DanegovImport onCreated={onCreated} />)
    fireEvent.click(await screen.findByLabelText('Importuj: Zbiór 2'))
    fireEvent.click(screen.getByRole('button', { name: 'Importuj wybrane zbiory (1)' }))
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(batch))
    expect(api.importFromDanegov).toHaveBeenCalledWith(['1'])
  })
  it('odśwież wymusza ponowne pobranie katalogu', async () => {
    render(<DanegovImport onCreated={() => {}} />)
    await screen.findByText('Zbiór 1')
    fireEvent.click(screen.getByRole('button', { name: 'Odśwież katalog z portalu' }))
    await waitFor(() => expect(api.getCatalog).toHaveBeenLastCalledWith(true))
  })
  it('błąd portalu (504/502) ma czytelny komunikat i przycisk ponowienia', async () => {
    api.getCatalog.mockRejectedValue(Object.assign(new Error('x'), { code: 'UPSTREAM_TIMEOUT', status: 504, details: [] }))
    render(<DanegovImport onCreated={() => {}} />)
    expect(await screen.findByText(/nie odpowiedział w wyznaczonym czasie/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Spróbuj ponownie' })).toBeInTheDocument()
  })
  it('błąd importu (422) pokazuje szczegóły i nie przechodzi dalej', async () => {
    api.importFromDanegov.mockRejectedValue(Object.assign(new Error('Żaden z wybranych zbiorów nie nadaje się do importu.'),
      { code: 'UNPROCESSABLE', status: 422, details: [{ komunikat: 'Zbiór 3: zasób zewnętrzny' }] }))
    const onCreated = vi.fn()
    render(<DanegovImport onCreated={onCreated} />)
    await screen.findByText('Zbiór 1')
    fireEvent.click(screen.getByRole('button', { name: /Importuj wybrane zbiory/ }))
    expect(await screen.findByText('Żaden z wybranych zbiorów nie nadaje się do importu.')).toBeInTheDocument()
    expect(screen.getByText(/Zbiór 3: zasób zewnętrzny/)).toBeInTheDocument()
    expect(onCreated).not.toHaveBeenCalled()
  })
  it('pusty katalog: komunikat', async () => {
    api.getCatalog.mockResolvedValue({ ...catalog, items: [] })
    render(<DanegovImport onCreated={() => {}} />)
    expect(await screen.findByText(/nie znaleziono zbiorów/)).toBeInTheDocument()
  })
})

describe('MappingTable – uwagi o kolumnach pomocniczych', () => {
  it('wyświetla uwagi (geometria, składanie adresu)', () => {
    const source = { zrodlo_id: 's1', nazwa: 'Demo', nazwa_pliku: 'd.csv', format: 'csv', kodowanie: 'utf-8', separator: ';', liczba_wierszy: 2,
      kontrola_naglowkow: { brakujace: [], nadmiarowe: [], powtorzone: [], uwagi: ['Adres zostanie złożony z kolumn: street + home_number.'] },
      proponowane_mapowanie: [{ kolumna: 'street', pole: 'adres', pewnosc: 'wysoka' }] }
    render(<MappingTable source={source} fields={schema.pola} value={{ street: 'adres' }} onChange={() => {}} />)
    expect(screen.getByText(/Adres zostanie złożony z kolumn/)).toBeInTheDocument()
  })
})
