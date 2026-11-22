import { describe, expect, it } from 'vitest'
import { errorLines, fieldErrors } from '../lib/errors.js'
import { formatDistance, formatDate } from '../lib/format.js'
import { isValidRegonFormat } from '../lib/regon.js'
import { defaultFor, formFields, isRequired } from '../lib/fields.js'
import { byDistance, matchesQuery } from '../lib/aedList.js'
import { placeCallout } from '../lib/callout.js'
import { dominantTone, pinTone } from '../lib/labels.js'
import { clusterIcon } from '../lib/mapIcons.js'
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
    const { coords, groups } = formFields(schema)
    const names = groups.flatMap((g) => g.items.map((i) => i.nazwa))
    expect(coords.map((c) => c.nazwa)).toEqual(['lat', 'lon']) // współrzędne: osobno (mapa/GPS), nie w zwykłych polach
    expect(names).not.toContain('lat'); expect(names).toContain('nowe_pole_z_xlsx')
    for (const hidden of ['aed_id', 'nazwa_dostawcy', 'data_importu', 'data_ostatniego_potwierdzenia']) expect(names).not.toContain(hidden)
    expect(groups.at(-1).id).toBe('inne')
  })
  it('wartości domyślne: brak informacji = „nieznane”, nigdy wartość sugerująca dostępność', () => {
    const dict = schema.slowniki
    expect(defaultFor(schema.pola.find((p) => p.nazwa === 'dostepnosc'), dict)).toBe('nieznana')
    expect(defaultFor(schema.pola.find((p) => p.nazwa === 'stan'), dict)).toBe('nieznany')
    expect(defaultFor(schema.pola.find((p) => p.nazwa === 'adres'), dict)).toBe('')
    expect(defaultFor({ nazwa: 'x', typ: 'slownik' }, { x: ['calodobowo'] })).toBe('')
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
  it('kafelek: z prawej strony markera, z lewej przy prawej krawędzi, zawsze w obrębie mapy', () => {
    const size = { w: 360, h: 300 }, box = { w: 1200, h: 700 }
    expect(placeCallout({ x: 500, y: 350 }, size, box)).toMatchObject({ side: 'right', x: 522 })
    const near = placeCallout({ x: 1100, y: 350 }, size, box)
    expect(near.side).toBe('left'); expect(near.x + size.w).toBeLessThanOrEqual(1100)
    for (const pt of [{ x: 0, y: 0 }, { x: 1200, y: 700 }, { x: 600, y: -50 }]) {
      const r = placeCallout(pt, size, box)
      expect(r.x).toBeGreaterThanOrEqual(8); expect(r.y).toBeGreaterThanOrEqual(8)
      expect(r.x + size.w).toBeLessThanOrEqual(box.w - 8); expect(r.y + size.h).toBeLessThanOrEqual(box.h - 8)
    }
  })
  it('kafelek na wąskim ekranie leży nad markerem (a pod nim, gdy nad nie ma miejsca)', () => {
    const size = { w: 300, h: 260 }, box = { w: 390, h: 700 }
    const top = placeCallout({ x: 195, y: 500 }, size, box)
    expect(top.side).toBe('top'); expect(top.y + size.h).toBeLessThanOrEqual(500)
    expect(placeCallout({ x: 195, y: 120 }, size, box).side).toBe('bottom')
  })
  it('odległość jest tylko informacją i kolejnością; wyszukiwarka ignoruje wielkość liter i polskie znaki', () => {
    const items = [{ aed_id: 'far', lat: 54.35, lon: 18.65, miasto: 'Gdańsk' }, { aed_id: 'near', lat: 52.23, lon: 21.01, miasto: 'Warszawa' }]
    const sorted = byDistance(items, { lat: 52.2297, lon: 21.0122 })
    expect(sorted.map((i) => i.aed_id)).toEqual(['near', 'far']); expect(sorted[1].odleglosc_m).toBeGreaterThan(200000)
    expect(byDistance(items, null)).toBe(items)
    expect(matchesQuery(items[0], 'gdansk')).toBe(true); expect(matchesQuery(items[0], 'WARSZAWA')).toBe(false); expect(matchesQuery(items[0], '')).toBe(true)
  })
  it('kolor pinezki: zielony działa, żółty w godzinach/z ograniczeniem, czerwony nie działa, „?” brak danych', () => {
    const it = (wartosc, dostepnosc) => ({ status_dostepnosci: { wartosc }, dostepnosc })
    expect(pinTone(it('dostepny', 'calodobowo')).cls).toBe('ok')
    expect(pinTone(it('dostepny', 'w_godzinach')).cls).toBe('hours')
    expect(pinTone(it('ograniczony_dostep', 'calodobowo')).cls).toBe('hours')
    expect(pinTone(it('niedostepny', 'w_godzinach')).cls).toBe('bad')
    expect(pinTone(it('nieznany', 'nieznana'))).toMatchObject({ cls: 'unk', icon: '?' })
    expect(pinTone(undefined).cls).toBe('unk')
  })
  it('skupisko: liczba punktów i kolor przeważającego rodzaju', () => {
    const mk = (wartosc, dostepnosc = 'calodobowo') => ({ status_dostepnosci: { wartosc }, dostepnosc })
    const items = [mk('niedostepny'), mk('niedostepny'), mk('niedostepny'), mk('dostepny'), mk('nieznany')]
    expect(dominantTone(items)).toBe('bad')
    expect(dominantTone([mk('dostepny'), mk('nieznany'), mk('nieznany')])).toBe('unk')
    expect(dominantTone([mk('dostepny'), mk('nieznany')])).toBe('ok') // remis: kolejność ok, w godzinach, nie działa, brak danych
    const icon = clusterIcon({ getAllChildMarkers: () => items.map((item) => ({ options: { item } })) })
    expect(icon.options.html).toContain('cluster-bad'); expect(icon.options.html).toContain('<span>5</span>')
  })
})
