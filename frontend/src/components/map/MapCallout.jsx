import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { useMap } from 'react-leaflet'
import { placeCallout } from '../../lib/callout.js'

/**
 * Kafelek przypięty do markera: pozycję w pikselach kontenera przelicza z współrzędnych geograficznych
 * przy każdym ruchu i zoomie mapy, bezpośrednio na elemencie (translate3d), bez ponownego renderowania Reacta.
 */
export default function MapCallout({ item, children }) {
  const map = useMap()
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    L.DomEvent.disableClickPropagation(el)
    L.DomEvent.disableScrollPropagation(el)
    const update = () => {
      const size = map.getSize()
      const pt = map.latLngToContainerPoint([item.lat, item.lon])
      const { x, y, side } = placeCallout(pt, { w: el.offsetWidth, h: el.offsetHeight }, { w: size.x, h: size.y })
      el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`
      el.dataset.side = side
      el.style.setProperty('--tail-y', `${Math.round(Math.min(Math.max(pt.y - 21 - y, 16), el.offsetHeight - 16))}px`)
    }
    update()
    const events = 'move zoom moveend zoomend viewreset resize'
    map.on(events, update)
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update) // zmiana wysokości po załadowaniu danych
    ro?.observe(el)
    return () => { map.off(events, update); ro?.disconnect() }
  }, [map, item.lat, item.lon])
  return <div className="callout" ref={ref}>{children}</div>
}
