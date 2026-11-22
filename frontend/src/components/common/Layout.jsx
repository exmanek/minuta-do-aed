import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext.jsx'

export default function Layout() {
  const { provider, token, signOut } = useAuth()
  const nav = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false) // menu mobilne (poniżej 900 px)
  const { pathname } = useLocation()
  useEffect(() => setMenuOpen(false), [pathname])
  useEffect(() => {
    if (!menuOpen) return undefined
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menuOpen])
  const isMap = pathname === '/' // mapa zajmuje cały ekran pod nagłówkiem, bez stopki
  return (
    <div className={`app${isMap ? ' app--map' : ''}`}>
      <a className="skip-link" href="#main">Przejdź do treści</a>
      <header className="topbar">
        <div className="inner">
          <Link to="/" className="brand"><img className="brand-logo" src="/logo.png" alt="Minuta do AED – strona główna" width="85" height="40" /></Link>
          <div className={`menu${menuOpen ? ' open' : ''}`} id="main-menu">
            <nav aria-label="Główna nawigacja">
              <NavLink to="/" end>Mapa AED</NavLink>
              {token && <>
                <NavLink to="/standard">Standard danych</NavLink>
                <NavLink to="/dostawca/agregacja">Import</NavLink>
                <NavLink to="/dostawca/dodaj">Dodaj AED</NavLink>
                <NavLink to="/dostawca/punkty">Moje punkty</NavLink>
              </>}
            </nav>
            <div className="menu-account">
              {token
                ? <>
                    <span className="small who" title={provider?.nazwa}>{provider?.nazwa || 'Dostawca'}</span>
                    <button type="button" className="linklike" onClick={() => { signOut(); nav('/') }}>Wyloguj</button>
                  </>
                : <NavLink to="/dostawca/logowanie" className="linklike">Panel dostawcy</NavLink>}
            </div>
          </div>
          <span className="spacer" />
          <a className="sos" href="tel:112" aria-label="Nagły wypadek: zadzwoń pod numer alarmowy 112"><span className="sos-text">Nagły wypadek</span> <strong>112</strong></a>
          <button type="button" className="menu-toggle" aria-expanded={menuOpen} aria-controls="main-menu" onClick={() => setMenuOpen((o) => !o)}>
            <span className="sr-only">{menuOpen ? 'Zamknij menu' : 'Otwórz menu'}</span><span aria-hidden="true">{menuOpen ? '✕' : '☰'}</span>
          </button>
        </div>
      </header>
      <main id="main" tabIndex={-1}><Outlet /></main>
      {!isMap && <footer className="app-footer">
        <p>Aplikacja nie zastępuje numeru alarmowego <a href="tel:112">112</a>.</p>
        <p>Minuta do AED · prototyp hackathonowy HackNation 2026 · zadanie „Misja AED – Dane na ratunek”.</p>
        <p>Mapa: © <a href="https://www.openstreetmap.org/copyright">współtwórcy OpenStreetMap</a>. Eksport plików nie jest publikacją w dane.gov.pl.</p>
      </footer>}
    </div>
  )
}
