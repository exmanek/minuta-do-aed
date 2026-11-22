import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext.jsx'

export default function RequireProvider({ children }) {
  const { token, checking } = useAuth()
  const loc = useLocation()
  if (checking) return <p role="status">Sprawdzanie sesji…</p>
  if (!token) return <Navigate to="/dostawca/logowanie" replace state={{ from: loc.pathname + loc.search }} />
  return children
}
