import { useSchema } from '../auth/SchemaContext.jsx'
import { LoadError, Loading } from '../components/common/Feedback.jsx'
import ProviderGuide from '../components/standard/ProviderGuide.jsx'
import SchemaTable from '../components/standard/SchemaTable.jsx'
import TemplateDownload from '../components/standard/TemplateDownload.jsx'

export default function StandardPage() {
  const { schema, loading, error, reload } = useSchema()
  return (
    <>
      <h1>Wzorcowy zakres danych AED</h1>
      <p>Poniższe pola pochodzą z pliku wzorcowego XLSX – jedynego źródła prawdy o nazwach pól, typach i słownikach.</p>
      <TemplateDownload />
      {loading && <Loading />}<LoadError error={error} onRetry={reload} />
      {schema && (
        <>
          <h2>Pola rekordu AED</h2>
          <SchemaTable fields={schema.pola} slowniki={schema.slowniki} caption="Pola rekordu" />
          <h2>Opis źródła (wypełniany przy imporcie)</h2>
          <SchemaTable fields={schema.zrodlo_pola || []} slowniki={schema.slowniki} caption="Pola źródła" />
          <h2>Pola wyliczane przez system</h2>
          <div className="table-wrap"><table><caption className="sr-only">Pola wyliczane</caption><thead><tr><th scope="col">Pole</th><th scope="col">Opis</th></tr></thead>
            <tbody>{(schema.pola_wyliczane || []).map((p) => <tr key={p.nazwa}><td><code>{p.nazwa}</code></td><td>{p.opis}</td></tr>)}</tbody></table></div>
        </>
      )}
      <ProviderGuide />
    </>
  )
}
