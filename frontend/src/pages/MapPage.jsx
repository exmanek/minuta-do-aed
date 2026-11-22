import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { listAllAed } from '../api/aed.js'
import AedCalloutCard from '../components/map/AedCalloutCard.jsx'
import AedList from '../components/map/AedList.jsx'
import FilterBar from '../components/map/FilterBar.jsx'
import LocationStatus from '../components/map/LocationStatus.jsx'
import MapLegend from '../components/map/MapLegend.jsx'
import MapView from '../components/map/MapView.jsx'
import SideDrawer from '../components/map/SideDrawer.jsx'
import DemoBanner from '../components/common/DemoBanner.jsx'
import { EmptyState, LoadError, Loading } from '../components/common/Feedback.jsx'
import { useApi } from '../hooks/useApi.js'
import { useGeolocation } from '../hooks/useGeolocation.js'
import { byDistance, matchesQuery } from '../lib/aedList.js'

const num = (v) => (v == null || v === '' ? null : Number(v))

export default function MapPage() {
  const [sp, setSp] = useSearchParams()
  const linkPos = num(sp.get('lat')) != null && num(sp.get('lon')) != null ? { lat: num(sp.get('lat')), lon: num(sp.get('lon')) } : null
  const [open, setOpen] = useState(true)
  const [query, setQuery] = useState('')
  const geo = useGeolocation(!linkPos) // pozycja GPS nie trafia do URL-a (dane osobowe)
  const pos = linkPos || geo.pos
  const source = linkPos ? 'link' : geo.pos ? 'gps' : 'none'
  const f = {
    dostepnosc_teraz: sp.get('dostepnosc_teraz') === 'true', tylko_aktualne: sp.get('tylko_aktualne') === 'true',
    status: (sp.get('status') || '').split(',').filter(Boolean),
  }
  const selected = sp.get('aed')

  const patch = (changes) => {
    const n = new URLSearchParams(sp)
    Object.entries(changes).forEach(([k, v]) => (v === null || v === '' || v === false || (Array.isArray(v) && !v.length) ? n.delete(k) : n.set(k, Array.isArray(v) ? v.join(',') : String(v))))
    setSp(n, { replace: true })
  }
  const setFilters = (nf) => patch({ dostepnosc_teraz: nf.dostepnosc_teraz, tylko_aktualne: nf.tylko_aktualne, status: nf.status })
  const select = (id) => patch({ aed: id })
  const deselect = () => patch({ aed: null })

  // Wszystkie zatwierdzone punkty naraz – bez promienia. Odległość jest tylko informacją i kolejnością listy.
  const { data, loading, error, reload } = useApi(() => listAllAed({
    dostepnosc_teraz: f.dostepnosc_teraz, tylko_aktualne: f.tylko_aktualne, status_dostepnosci: f.status.join(','),
  }), [JSON.stringify(f)])
  const items = useMemo(() => byDistance(data?.items || [], pos), [data, pos])
  const visible = useMemo(() => items.filter((i) => matchesQuery(i, query)), [items, query])

  return (
    <div className={`map-app${selected ? ' has-selected' : ''}`}>
      <MapView items={items} pos={pos} locating={geo.loading && !linkPos} selected={selected} onSelect={select} onDeselect={deselect}
        renderCallout={(item) => <AedCalloutCard id={item.aed_id} items={items} onSelect={select} onClose={deselect} />} />
      <SideDrawer open={open} onToggle={() => setOpen((o) => !o)} total={items.length} shown={visible.length} query={query} onQuery={setQuery}>
        <DemoBanner visible={items.some((i) => i.dane_przykladowe)} />
        <MapLegend />
        <LocationStatus source={source} loading={geo.loading && !linkPos} error={geo.error} onLocate={geo.locate} />
        <FilterBar f={f} onChange={setFilters} />
        {loading && <Loading />}
        <LoadError error={error} onRetry={reload} />
        {!loading && !error && data && visible.length === 0
          ? <EmptyState title="Brak punktów AED dla tych filtrów">Zmień filtry albo wyszukiwaną frazę.</EmptyState>
          : <AedList items={visible} selected={selected} onSelect={select} />}
      </SideDrawer>
    </div>
  )
}
