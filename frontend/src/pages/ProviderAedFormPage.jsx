import { Link, useSearchParams } from 'react-router-dom'
import { getAed } from '../api/aed.js'
import AedForm from '../components/provider/AedForm.jsx'
import { LoadError, Loading } from '../components/common/Feedback.jsx'
import { useApi } from '../hooks/useApi.js'

export default function ProviderAedFormPage() {
  const [sp] = useSearchParams()
  const id = sp.get('aed')
  const { data, loading, error, reload } = useApi(() => (id ? getAed(id) : null), [id])
  return (
    <>
      <h1>{id ? `Edycja punktu ${id}` : 'Dodaj punkt AED'}</h1>
      <p className="muted">Pola, etykiety i słowniki pochodzą ze wzorca danych (<Link to="/standard">standard danych</Link>). Walidacja działa na żywo.</p>
      {id && loading && <Loading />}
      <LoadError error={error} onRetry={reload} />
      {(!id || data) && <AedForm key={id || 'new'} existing={data} />}
    </>
  )
}
