export const Loading = ({ text = 'Ładowanie…' }) => <p role="status" aria-live="polite" className="muted">{text}</p>
export const EmptyState = ({ title, children }) => (
  <div className="card"><strong>{title}</strong>{children && <p className="muted">{children}</p>}</div>
)
export function LoadError({ error, onRetry }) {
  if (!error) return null
  return (
    <div className="alert bad" role="alert">
      Nie udało się pobrać danych: {error.message}
      {onRetry && <> <button type="button" onClick={onRetry}>Spróbuj ponownie</button></>}
    </div>
  )
}
