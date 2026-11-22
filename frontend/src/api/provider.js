import { request, downloadFile } from './client.js'
const enc = encodeURIComponent
export const login = (regon, haslo) => request('POST', '/provider/login', { json: { regon, haslo } })
export const me = () => request('GET', '/provider/me')
export const sources = () => request('GET', '/provider/sources')
export const createBatch = (files, metas) => {
  const fd = new FormData()
  files.forEach((f) => fd.append('files', f))
  fd.append('meta', JSON.stringify(metas))
  return request('POST', '/provider/batches', { formData: fd })
}
export const getBatch = (id) => request('GET', `/provider/batches/${enc(id)}`)
export const putMapping = (id, mapowanie) => request('PUT', `/provider/batches/${enc(id)}/mapping`, { json: { mapowanie } })
export const processBatch = (id) => request('POST', `/provider/batches/${enc(id)}/process`)
export const getReport = (id, poziom) => request('GET', `/provider/batches/${enc(id)}/report`, { query: { poziom } })
export const downloadReportCsv = (id) => downloadFile(`/provider/batches/${enc(id)}/report`, { format: 'csv' }, `raport_${id}.csv`)
export const getDuplicates = (id) => request('GET', `/provider/batches/${enc(id)}/duplicates`)
export const postDecisions = (id, decyzje) => request('POST', `/provider/batches/${enc(id)}/duplicates/decisions`, { json: { decyzje } })
export const commitBatch = (id, payload) => request('POST', `/provider/batches/${enc(id)}/commit`, { json: payload })
export const downloadBatchExport = (id, format) => downloadFile(`/provider/batches/${enc(id)}/export`, { format }, `aed.${format}`)
// pojedyncze AED
export const listOwnAed = () => request('GET', '/provider/aed', { query: { limit: 200 } })
export const validateAed = (rec) => request('POST', '/provider/aed/validate', { json: rec })
export const createAed = (rec) => request('POST', '/provider/aed', { json: rec })
export const updateAed = (id, rec) => request('PUT', `/provider/aed/${enc(id)}`, { json: rec })
export const withdrawAed = (id) => request('DELETE', `/provider/aed/${enc(id)}`)
export const aedHistory = (id) => request('GET', `/provider/aed/${enc(id)}/history`)
