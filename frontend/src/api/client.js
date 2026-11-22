// Wspólny wrapper fetch. Kontrakt: docs/api-contract.md
const BASE = '/api/v1'
const TOKEN_KEY = 'aed_token'
const store = (fn) => { try { return fn() } catch { return null } }

export class ApiError extends Error {
  constructor(status, code, message, details = []) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

export const getToken = () => store(() => sessionStorage.getItem(TOKEN_KEY))
export const setToken = (t) => store(() => (t ? sessionStorage.setItem(TOKEN_KEY, t) : sessionStorage.removeItem(TOKEN_KEY)))

async function toError(res) {
  let err = {}
  try { err = (await res.json()).error || {} } catch { /* odpowiedź nie-JSON */ }
  if (res.status === 401 && getToken()) {
    setToken(null)
    window.dispatchEvent(new Event('aed:unauthorized'))
  }
  return new ApiError(res.status, err.code || 'HTTP_ERROR', err.message || res.statusText || 'Błąd serwera', err.details || [])
}

async function send(method, path, { query, json, formData } = {}) {
  const qs = query
    ? new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== false)).toString()
    : ''
  const headers = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  let body
  if (json !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json) }
  else if (formData) body = formData // przeglądarka sama dopisze granicę multipart
  try {
    return await fetch(BASE + path + (qs ? `?${qs}` : ''), { method, headers, body })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Brak połączenia z serwerem API.')
  }
}

export async function request(method, path, opts = {}) {
  const res = await send(method, path, opts)
  if (!res.ok) throw await toError(res)
  return opts.text ? res.text() : res.json()
}

/** Pobranie pliku przez fetch (z tokenem) i zapis przez tymczasowy link. */
export async function downloadFile(path, query, fallbackName = 'plik') {
  const res = await send('GET', path, { query })
  if (!res.ok) throw await toError(res)
  const cd = res.headers.get('Content-Disposition') || ''
  const name = /filename="?([^";]+)"?/.exec(cd)?.[1] || fallbackName
  const url = URL.createObjectURL(await res.blob())
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return name
}
