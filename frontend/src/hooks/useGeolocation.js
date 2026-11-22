import { useCallback, useEffect, useState } from 'react'

const MESSAGES = {
  unsupported: 'Przeglądarka nie obsługuje geolokalizacji.',
  denied: 'Brak zgody na lokalizację.',
  failed: 'Nie udało się ustalić lokalizacji.',
}

/**
 * Pozycja użytkownika z GPS. Przy `auto` próbuje ją pobrać od razu po zamontowaniu.
 * Zwraca { pos: {lat, lon} | null, error: kod komunikatu | null, loading, locate }.
 */
export function useGeolocation(auto = true) {
  const [state, setState] = useState({ pos: null, error: null, loading: auto })
  const locate = useCallback(() => {
    if (!navigator.geolocation) return setState({ pos: null, loading: false, error: MESSAGES.unsupported })
    setState((s) => ({ ...s, loading: true, error: null }))
    navigator.geolocation.getCurrentPosition(
      (p) => setState({ pos: { lat: p.coords.latitude, lon: p.coords.longitude }, loading: false, error: null }),
      (e) => setState((s) => ({ ...s, loading: false, error: e.code === 1 ? MESSAGES.denied : MESSAGES.failed })),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    )
  }, [])
  useEffect(() => { if (auto) locate() }, [auto, locate])
  return { ...state, locate }
}
