import { request } from './client.js'
export const login = (regon, haslo) => request('POST', '/provider/login', { json: { regon, haslo } })
export const createBatch = (formData) => request('POST', '/provider/batches', { formData })
export const getBatch = (id) => request('GET', `/provider/batches/${id}`)
export const processBatch = (id) => request('POST', `/provider/batches/${id}/process`)
export const commitBatch = (id, payload) => request('POST', `/provider/batches/${id}/commit`, { json: payload })
