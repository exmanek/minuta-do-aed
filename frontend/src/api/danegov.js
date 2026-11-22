import { request } from './client.js'
export const getCatalog = (refresh = false) => request('GET', '/provider/danegov/catalog', { query: { refresh } })
export const importFromDanegov = (zbiory) => request('POST', '/provider/danegov/import', { json: { zbiory } })
