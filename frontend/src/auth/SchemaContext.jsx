import { createContext, useContext } from 'react'
import { getSchema } from '../api/standard.js'
import { useApi } from '../hooks/useApi.js'

export const SchemaContext = createContext({ schema: null, loading: true, error: null, reload: () => {} })
export const useSchema = () => useContext(SchemaContext)

export function SchemaProvider({ children }) {
  const { data, loading, error, reload } = useApi(getSchema, [])
  return <SchemaContext.Provider value={{ schema: data, loading, error, reload }}>{children}</SchemaContext.Provider>
}
