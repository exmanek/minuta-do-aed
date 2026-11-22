import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'
import { listOwnAed, withdrawAed } from '../api/provider.js'
import Dialog from '../components/common/Dialog.jsx'
import ErrorSummary from '../components/common/ErrorSummary.jsx'
import { EmptyState, LoadError, Loading } from '../components/common/Feedback.jsx'
import { FreshnessBadge, StatusBadge } from '../components/common/StatusBadge.jsx'
import HistoryList from '../components/provider/HistoryList.jsx'
import { useApi } from '../hooks/useApi.js'

export default function ProviderMyAedPage() {
  const { data, loading, error, reload } = useApi(listOwnAed, [])
  const [confirm, setConfirm] = useState(null)
  const [open, setOpen] = useState(null)
  const [err, setErr] = useState(null)
  const doWithdraw = async () => {
    try { await withdrawAed(confirm); setConfirm(null); reload() } catch (e) { setErr(e); setConfirm(null) }
  }
  return (
    <>
      <h1>Moje punkty AED</h1>
      <div className="btn-row"><Link className="btn primary" to="/dostawca/dodaj">Dodaj punkt</Link><Link className="btn" to="/dostawca/agregacja">Importuj z pliku</Link></div>
      <ErrorSummary error={err} />
      {loading && <Loading />}<LoadError error={error} onRetry={reload} />
      {data && data.items.length === 0 && <EmptyState title="Nie masz jeszcze punktów">Dodaj punkt formularzem lub zaimportuj plik.</EmptyState>}
      {data && data.items.length > 0 && (
        <div className="table-wrap"><table>
          <thead><tr><th scope="col">ID</th><th scope="col">Adres</th><th scope="col">Rekord</th><th scope="col">Dostępność</th><th scope="col">Aktualność</th><th scope="col">Akcje</th></tr></thead>
          <tbody>{data.items.map((a) => (
            <Fragment key={a.aed_id}>
              <tr>
                <td>{a.aed_id}</td><td>{a.adres}, {a.miasto}</td>
                <td>{a.status === 'wycofany' ? <span className="badge unk">Wycofany</span> : <span className="badge ok">Zatwierdzony</span>}</td>
                <td><StatusBadge status={a.status_dostepnosci} /></td><td><FreshnessBadge value={a.znacznik_aktualnosci} /></td>
                <td><div className="btn-row" style={{ margin: 0 }}>
                  {a.status !== 'wycofany' && <Link className="btn" to={`/dostawca/dodaj?aed=${a.aed_id}`}>Edytuj</Link>}
                  <button type="button" aria-expanded={open === a.aed_id} onClick={() => setOpen(open === a.aed_id ? null : a.aed_id)}>Historia</button>
                  {a.status !== 'wycofany' && <button type="button" className="danger" onClick={() => setConfirm(a.aed_id)}>Wycofaj</button>}
                </div></td>
              </tr>
              {open === a.aed_id && <tr><td colSpan={6}><HistoryList aedId={a.aed_id} /></td></tr>}
            </Fragment>))}</tbody>
        </table></div>
      )}
      {confirm && (
        <Dialog title="Wycofać punkt?" onClose={() => setConfirm(null)}>
          <p>Punkt <strong>{confirm}</strong> zniknie z mapy i eksportu. Historia zmian zostanie zachowana.</p>
          <div className="btn-row"><button type="button" className="danger" onClick={doWithdraw}>Tak, wycofaj</button><button type="button" onClick={() => setConfirm(null)}>Anuluj</button></div>
        </Dialog>)}
    </>
  )
}
