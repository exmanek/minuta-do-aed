import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { listAed } from '../api/aed.js'
import AedCard from '../components/map/AedCard.jsx'
import AedList from '../components/map/AedList.jsx'
import FilterBar from '../components/map/FilterBar.jsx'
import LocationSearch from '../components/map/LocationSearch.jsx'
import MapView from '../components/map/MapView.jsx'
import DemoBanner from '../components/common/DemoBanner.jsx'
import { EmptyState, LoadError, Loading } from '../components/common/Feedback.jsx'
import Tabs from '../components/common/Tabs.jsx'
import { useApi } from '../hooks/useApi.js'

const num = (v) => (v == null || v === '' ? null : Number(v))

export default function MapPage() {
  const [sp, setSp] = useSearchParams()
  const pos = num(sp.get('lat')) != null && num(sp.get('lon')) != null ? { lat: num(sp.get('lat')), lon: num(sp.get('lon')) } : null
  const f = {
    dostepnosc_teraz: sp.get('dostepnosc_teraz') === 'true', tylko_aktualne: sp.get('tylko_aktualne') === 'true',
    status: (sp.get('status') || '').split(',').filter(Boolean), radius_m: num(sp.get('radius_m')) || 2000,
  }
  const selected = sp.get('aed'), view = sp.get('view') || 'lista'

  const patch = (changes) => {
    const n = new URLSearchParams(sp)
    Object.entries(changes).forEach(([k, v]) => (v === null || v === '' || v === false || (Array.isArray(v) && !v.length) ? n.delete(k) : n.set(k, Array.isArray(v) ? v.join(',') : String(v))))
    setSp(n, { replace: true })
  }
  const setFilters = (nf) => patch({ dostepnosc_teraz: nf.dostepnosc_teraz, tylko_aktualne: nf.tylko_aktualne, status: nf.status, radius_m: nf.radius_m === 2000 ? null : nf.radius_m })

  const key = JSON.stringify([pos, f])
  const { data, loading, error, reload } = useApi(() => listAed({
    ...(pos ? { lat: pos.lat, lon: pos.lon, radius_m: f.radius_m, sort: 'odleglosc' } : {}),
    dostepnosc_teraz: f.dostepnosc_teraz, tylko_aktualne: f.tylko_aktualne, status_dostepnosci: f.status.join(','), limit: 200,
  }), [key])
  const items = useMemo(() => data?.items || [], [data])
  const anyDemo = items.some((i) => i.dane_przykladowe)

  const select = (id) => patch({ aed: id })
  return (
    <>
      <h1>Znajdź najbliższy defibrylator AED</h1>
      <DemoBanner visible={anyDemo} />
      <LocationSearch pos={pos} onPos={(p) => patch({ lat: p.lat.toFixed(5), lon: p.lon.toFixed(5) })} onClear={() => patch({ lat: null, lon: null })} />
      <FilterBar f={f} onChange={setFilters} hasPos={!!pos} />
      <div role="status" aria-live="polite">
        {loading ? <Loading /> : data && <p className="muted">Znaleziono punktów: <strong>{data.liczba}</strong>{!pos && ' (ustaw lokalizację, aby posortować wg odległości)'}</p>}
      </div>
      <LoadError error={error} onRetry={reload} />
      {selected && <AedCard id={selected} items={items} onSelect={select} onClose={() => patch({ aed: null })} />}
      <div className={`map-layout ${view === 'lista' ? 'hide-mobile-map' : 'hide-mobile-list'}`}>
        <div className="mobile-tabs" style={{ gridColumn: '1 / -1' }}>
          <Tabs label="Widok" value={view} onChange={(v) => patch({ view: v === 'lista' ? null : v })} tabs={[{ id: 'lista', label: 'Lista' }, { id: 'mapa', label: 'Mapa' }]} />
        </div>
        <div className="list-col list-box">
          {!loading && !error && items.length === 0
            ? <EmptyState title="Brak punktów AED dla tych filtrów">Zwiększ promień, zmień filtry albo usuń lokalizację.</EmptyState>
            : <AedList items={items} selected={selected} onSelect={select} />}
        </div>
        <div className="map-col">
          <MapView items={items} pos={pos} radius={f.radius_m} selected={selected} onSelect={select}
            onPick={(p) => patch({ lat: p.lat, lon: p.lon })} />
        </div>
      </div>
    </>
  )
}
