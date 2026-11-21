import { useEffect, useState } from 'react'
import { getSchema } from '../api/standard.js'

export default function StandardPage() {
  const [schema, setSchema] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => { getSchema().then(setSchema).catch(setError) }, [])
  return (
    <>
      <h1>Standard danych AED</h1>
      {error && <p className="error">Błąd API: {error.message}</p>}
      {schema && (
        <table>
          <thead><tr><th>Pole</th><th>Status</th><th>Typ</th><th>Etykieta</th></tr></thead>
          <tbody>
            {schema.pola.map((p) => (
              <tr key={p.nazwa}><td>{p.nazwa}</td><td>{p.status}</td><td>{p.typ}</td><td>{p.etykieta}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
