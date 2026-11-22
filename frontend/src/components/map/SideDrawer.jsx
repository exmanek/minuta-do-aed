/**
 * Pływający, zwijany panel z listą punktów (z lewej na desktopie, od dołu na telefonie).
 * Zwinięty zostawia tylko przycisk z licznikiem, żeby nie zasłaniać mapy.
 */
export default function SideDrawer({ open, onToggle, total, shown, query, onQuery, children }) {
  if (!open) {
    return <button type="button" className="drawer-fab" onClick={onToggle} aria-expanded="false" aria-controls="side-drawer">Lista AED <span className="count">{total}</span></button>
  }
  return (
    <aside className="side-drawer" id="side-drawer" aria-label="Lista punktów AED">
      <header className="side-head">
        <div>
          <h1>Defibrylatory AED</h1>
          <p className="counter" role="status" aria-live="polite">
            <strong>{shown}</strong>{shown !== total && <span> z {total}</span>} <span className="muted">punktów na mapie</span>
          </p>
        </div>
        <button type="button" className="icon-btn" onClick={onToggle} aria-expanded="true" aria-controls="side-drawer" aria-label="Ukryj listę punktów">‹</button>
      </header>
      <div className="side-search">
        <label htmlFor="aed-search" className="sr-only">Szukaj punktu (adres, miasto, miejsce w obiekcie)</label>
        <input id="aed-search" type="search" placeholder="Szukaj adresu, miasta, miejsca w obiekcie…" value={query} onChange={(e) => onQuery(e.target.value)} />
      </div>
      <div className="side-body">{children}</div>
    </aside>
  )
}
