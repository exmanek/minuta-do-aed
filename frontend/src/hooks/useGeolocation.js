import { useCallback, useState } from 'react'
export function useGeolocation() {
  const [state, setState] = useState({ pos: null, error: null, loading: false })
  const locate = useCallback(() => {
    if (!navigator.geolocation) return setState({ pos: null, loading: false, error: 'Przeglądarka nie obsługuje geolokalizacji.' })
    setState((s) => ({ ...s, loading: true, error: null }))
    navigator.geolocation.getCurrentPosition(
      (p) => setState({ pos: { lat: p.coords.latitude, lon: p.coords.longitude }, loading: false, error: null }),
      (e) => setState({ pos: null, loading: false, error: e.code === 1 ? 'Odmowa dostępu do lokalizacji. Wpisz współrzędne lub kliknij na mapie.' : 'Nie udało się ustalić lokalizacji.' }),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }, [])
  return { ...state, locate }
}
