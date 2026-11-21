// Wspólny wrapper fetch. Kontrakt: docs/api-contract.md
const BASE = '/api/v1'
const TOKEN_KEY = 'aed_token'

export class ApiError extends Error {
  constructor(status, code, message, details = []) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

export const getToken = () => sessionStorage.getItem(TOKEN_KEY)
export const setToken = (t) => (t ? sessionStorage.setItem(TOKEN_KEY, t) : sessionStorage.removeItem(TOKEN_KEY))

export async function request(method, path, { query, json, formData, blob } = {}) {
  const qs = query
    ? '?' + new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString()
    : ''
  const headers = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  let body
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(json)
  } else if (formData) {
    body = formData // przeglądarka sama dopisze granicę multipart
  }
  let res
  try {
    res = await fetch(BASE + path + (qs === '?' ? '' : qs), { method, headers, body })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Brak połączenia z serwerem API.')
  }
  if (res.ok) return blob ? res.blob() : res.json()
  let err = {}
  try { err = (await res.json()).error || {} } catch { /* odpowiedź nie-JSON */ }
  if (res.status === 401) {
    setToken(null)
    window.dispatchEvent(new Event('aed:unauthorized'))
  }
  throw new ApiError(res.status, err.code || 'HTTP_ERROR', err.message || res.statusText, err.details || [])
}
