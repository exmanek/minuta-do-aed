import { useEffect, useRef } from 'react'
import L from '../../lib/leafletGlobal.js'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import { useMap } from 'react-leaflet'
import { aedIcon, clusterIcon } from '../../lib/mapIcons.js'
import { pinTone } from '../../lib/labels.js'

/**
 * Wszystkie punkty AED z grupowaniem: bliskie punkty (także leżące dokładnie na sobie) łączą się w okrąg z liczbą,
 * a przybliżenie rozdziela je; na maksymalnym zoomie nakładające się punkty rozsuwają się (spiderfy).
 */
export default function ClusterLayer({ items, selected, onSelect }) {
  const map = useMap()
  const group = useRef(null)
  const markers = useRef(new Map())
  const prevSelected = useRef(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  useEffect(() => {
    const g = L.markerClusterGroup({ iconCreateFunction: clusterIcon, showCoverageOnHover: false, maxClusterRadius: 55, chunkedLoading: true })
    const byId = new Map()
    g.addLayers(items.map((item) => {
      const m = L.marker([item.lat, item.lon], { icon: aedIcon(item, false), title: `${item.adres || ''}, ${item.miasto || ''} – ${pinTone(item).text}`, item })
      m.on('click', () => onSelectRef.current(item.aed_id))
      byId.set(item.aed_id, m)
      return m
    }))
    map.addLayer(g)
    group.current = g; markers.current = byId; prevSelected.current = null
    return () => { map.removeLayer(g); group.current = null }
  }, [map, items])

  useEffect(() => { // wyróżnienie wybranego punktu i odsłonięcie go, jeśli siedzi w skupisku
    const byId = markers.current
    const set = (id, on) => { const m = byId.get(id); if (m) m.setIcon(aedIcon(m.options.item, on)) }
    if (prevSelected.current !== selected) set(prevSelected.current, false)
    set(selected, true)
    prevSelected.current = selected
    const m = byId.get(selected)
    if (!m || !group.current) return undefined
    const reveal = () => { if (group.current?.getVisibleParent(m) !== m) group.current.zoomToShowLayer(m) }
    map.once('moveend', reveal)
    return () => map.off('moveend', reveal)
  }, [map, selected, items])
  return null
}
