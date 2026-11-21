import { request } from './client.js'
export const health = () => request('GET', '/health')
export const listAed = (query) => request('GET', '/aed', { query })
export const getAed = (id) => request('GET', `/aed/${encodeURIComponent(id)}`)
export const exportUrls = { csv: '/api/v1/export/aed.csv', json: '/api/v1/export/aed.json' }
