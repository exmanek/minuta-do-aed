import { request } from './client.js'
export const health = () => request('GET', '/health')
export const listAed = (query) => request('GET', '/aed', { query })
export const getAed = (id) => request('GET', `/aed/${encodeURIComponent(id)}`)
export const getReports = (id) => request('GET', `/aed/${encodeURIComponent(id)}/reports`)
export const postReport = (id, typ, komentarz) =>
  request('POST', `/aed/${encodeURIComponent(id)}/reports`, { json: { typ, ...(komentarz ? { komentarz } : {}) } })
export const exportUrls = {
  csv: '/api/v1/export/aed.csv', json: '/api/v1/export/aed.json', geojson: '/api/v1/export/aed.geojson',
  zrodla: '/api/v1/export/zrodla.csv', aedZrodla: '/api/v1/export/aed_zrodla.csv',
  metadataJson: '/api/v1/export/metadata.json', metadataXml: '/api/v1/export/metadata.xml',
}
