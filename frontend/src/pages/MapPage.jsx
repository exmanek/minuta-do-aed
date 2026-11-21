import { useEffect, useState } from 'react'
import { health, listAed } from '../api/aed.js'

// TODO(frontend): react-leaflet, filtry, AedCard, UrgentPanel. Na razie tylko dowód integracji z API.
export default function MapPage() {
  const [state, setState] = useState({ health: null, aed: null, error: null })
  useEffect(() => {
    Promise.all([health(), listAed({ limit: 20 })])
      .then(([h, a]) => setState({ health: h, aed: a, error: null }))
      .catch((e) => setState({ health: null, aed: null, error: e }))
  }, [])
  return (
    <>
      <h1>Mapa i lista AED</h1>
      {state.error && <p className="error">Błąd API: {state.error.code} – {state.error.message}</p>}
      <h2>GET /api/v1/health</h2>
      <pre>{JSON.stringify(state.health, null, 2)}</pre>
      <h2>GET /api/v1/aed</h2>
      <pre>{JSON.stringify(state.aed, null, 2)}</pre>
    </>
  )
}
