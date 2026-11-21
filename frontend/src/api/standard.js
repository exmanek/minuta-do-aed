import { request } from './client.js'
export const getSchema = () => request('GET', '/meta/schema')
