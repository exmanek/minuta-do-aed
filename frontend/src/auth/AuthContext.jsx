import { createContext, useContext, useEffect, useState } from 'react'
import { getToken, setToken } from '../api/client.js'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [token, setTok] = useState(getToken())
  const [provider, setProvider] = useState(null) // {regon, nazwa, status_weryfikacji}
  useEffect(() => {
    const onUnauth = () => { setTok(null); setProvider(null) }
    window.addEventListener('aed:unauthorized', onUnauth)
    return () => window.removeEventListener('aed:unauthorized', onUnauth)
  }, [])
  const signIn = (tok, prov) => { setToken(tok); setTok(tok); setProvider(prov) }
  const signOut = () => { setToken(null); setTok(null); setProvider(null) }
  return <AuthContext.Provider value={{ token, provider, signIn, signOut }}>{children}</AuthContext.Provider>
}
