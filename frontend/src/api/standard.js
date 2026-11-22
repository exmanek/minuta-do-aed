import { request } from './client.js'
export const getSchema = () => request('GET', '/meta/schema')
export const getDeclarations = () => request('GET', '/meta/oswiadczenie')
export const templateUrl = '/api/v1/standard/template.xlsx'
