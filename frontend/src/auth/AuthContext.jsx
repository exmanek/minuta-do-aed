import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import * as providerApi from '../api/provider.js'
import { getToken, setToken } from '../api/client.js'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [token, setTok] = useState(getToken())
  const [provider, setProvider] = useState(null) // {regon, nazwa, status_weryfikacji}
  const [checking, setChecking] = useState(!!getToken())

  const signOut = useCallback(() => { setToken(null); setTok(null); setProvider(null) }, [])
  const signIn = useCallback((tok, prov) => { setToken(tok); setTok(tok); setProvider(prov) }, [])

  useEffect(() => {
    const onUnauth = () => { setTok(null); setProvider(null) }
    window.addEventListener('aed:unauthorized', onUnauth)
    return () => window.removeEventListener('aed:unauthorized', onUnauth)
  }, [])

  useEffect(() => { // odtworzenie profilu po odświeżeniu karty
    if (!token || provider) { setChecking(false); return }
    providerApi.me().then(setProvider).catch(() => {}).finally(() => setChecking(false))
  }, [token, provider])

  const value = useMemo(() => ({ token, provider, checking, signIn, signOut }), [token, provider, checking, signIn, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
