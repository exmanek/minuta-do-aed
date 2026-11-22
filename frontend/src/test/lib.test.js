import { describe, expect, it } from 'vitest'
import { errorLines, fieldErrors } from '../lib/errors.js'
import { formatDistance, formatDate } from '../lib/format.js'
import { isValidRegonFormat } from '../lib/regon.js'
import { formFields, isRequired } from '../lib/fields.js'
import { mappingFromBatch } from '../lib/mapping.js'
import { emptySource, toMeta, validateSource } from '../components/provider/SourceScopeForm.jsx'
import { hasDuplicateTargets, usedTargets } from '../components/provider/MappingTable.jsx'
import { extOf } from '../components/provider/UploadPanel.jsx'
import { schema } from './fixtures.js'

describe('lib', () => {
  it('REGON: tylko format i suma kontrolna', () => {
    expect(isValidRegonFormat('123456785')).toBe(true)
    expect(isValidRegonFormat('123456789')).toBe(false)
    expect(isValidRegonFormat('12345')).toBe(false)
    expect(isValidRegonFormat('abc456785')).toBe(false)
  })
  it('błędy API -> pola i linie', () => {
    const e = { details: [{ pole: 'lat', komunikat: 'Brak współrzędnych.', regula: 'AED-REQ-001' }, { komunikat: 'Ogólny' }] }
    expect(fieldErrors(e)).toEqual({ lat: 'Brak współrzędnych.' })
    expect(errorLines(e)).toEqual(['lat: Brak współrzędnych.', 'Ogólny'])
    expect(fieldErrors(null)).toEqual({})
  })
  it('format odległości i dat', () => {
    expect(formatDistance(605)).toBe('605 m'); expect(formatDistance(1500)).toBe('1,5 km'); expect(formatDate(null)).toBe('brak')
  })
  it('rozszerzenia plików', () => { expect(extOf('Dane.XLSX')).toBe('xlsx'); expect(extOf('a.pdf')).toBe('pdf') })
  it('formularz AED: grupy z XLSX, pola ukryte pominięte, nowe pola trafiają do „Pozostałe”', () => {
    const groups = formFields(schema)
    const names = groups.flatMap((g) => g.items.map((i) => i.nazwa))
    expect(names).toContain('lat'); expect(names).toContain('nowe_pole_z_xlsx')
    for (const hidden of ['aed_id', 'nazwa_dostawcy', 'data_importu', 'data_ostatniego_potwierdzenia']) expect(names).not.toContain(hidden)
    expect(groups.at(-1).id).toBe('inne')
  })
  it('godziny_dostepu wymagane tylko dla w_godzinach', () => {
    const f = schema.pola.find((p) => p.nazwa === 'godziny_dostepu')
    expect(isRequired(f, { dostepnosc: 'calodobowo' })).toBe(false)
    expect(isRequired(f, { dostepnosc: 'w_godzinach' })).toBe(true)
  })
  it('mapowanie: blokada podwójnego pola i zajęte cele', () => {
    expect(hasDuplicateTargets({ a: 'lat', b: 'lat' })).toBe(true)
    expect(hasDuplicateTargets({ a: 'lat', b: 'lon', c: null })).toBe(false)
    expect([...usedTargets({ a: 'lat', b: 'lon' }, 'a')]).toEqual(['lon'])
  })
  it('mappingFromBatch: zatwierdzone ma pierwszeństwo przed propozycją', () => {
    const z = { zrodlo_id: 's1', proponowane_mapowanie: [{ kolumna: 'x', pole: 'lat' }], zatwierdzone_mapowanie: null }
    expect(mappingFromBatch({ zrodla: [z] })).toEqual({ s1: { x: 'lat' } })
    expect(mappingFromBatch({ zrodla: [{ ...z, zatwierdzone_mapowanie: { x: null } }] })).toEqual({ s1: { x: null } })
  })
  it('opis źródła: walidacja i meta', () => {
    const v = emptySource('demo.csv')
    expect(Object.keys(validateSource(v))).toEqual(['licencja', 'prawo_do_udostepniania', 'dysponent_nazwa', 'zakres_opis'])
    const ok = { ...v, licencja: 'CC BY 4.0', prawo_do_udostepniania: 'dane_wlasne', dysponent_nazwa: 'D', dysponent_regon: '123 456 785',
      zakres: { ...v.zakres, opis: 'Warszawa', teryt: '1465011, 1465012' }, dane_przykladowe: true }
    expect(validateSource(ok)).toEqual({})
    expect(validateSource({ ...ok, dysponent_regon: '123456789' }).dysponent_regon).toBeTruthy()
    const m = toMeta(ok)
    expect(m.dysponent_regon).toBe('123456785'); expect(m.zakres_referencyjny.obszar.teryt).toEqual(['1465011', '1465012']); expect(m.dane_przykladowe).toBe(true)
  })
})
