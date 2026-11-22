import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext.jsx'

export default function Layout() {
  const { provider, token, signOut } = useAuth()
  const nav = useNavigate()
  return (
    <>
      <a className="skip-link" href="#main">Przejdź do treści</a>
      <header className="app-header">
        <div className="inner">
          <Link to="/" className="brand">Minuta do AED</Link>
          <nav aria-label="Główna nawigacja">
            <NavLink to="/" end>Mapa AED</NavLink>
            <NavLink to="/standard">Standard danych</NavLink>
            {token && <>
              <NavLink to="/dostawca/agregacja">Import</NavLink>
              <NavLink to="/dostawca/dodaj">Dodaj AED</NavLink>
              <NavLink to="/dostawca/punkty">Moje punkty</NavLink>
            </>}
          </nav>
          <span className="spacer" />
          {token
            ? <>
                <span className="small" aria-live="polite">{provider ? `${provider.nazwa} · konto zweryfikowane przez administratora` : 'Dostawca'}</span>
                <button type="button" className="linklike" onClick={() => { signOut(); nav('/') }}>Wyloguj</button>
              </>
            : <NavLink to="/dostawca/logowanie" className="linklike">Panel dostawcy</NavLink>}
        </div>
      </header>
      <div className="emergency" role="note">W nagłym wypadku zadzwoń pod numer alarmowy <a href="tel:112">112</a>. Ta aplikacja go nie zastępuje.</div>
      <main id="main" tabIndex={-1}><Outlet /></main>
      <footer className="app-footer">
        <p>Minuta do AED · prototyp hackathonowy HackNation 2026 · zadanie „Misja AED – Dane na ratunek”.</p>
        <p>Mapa: © <a href="https://www.openstreetmap.org/copyright">współtwórcy OpenStreetMap</a>. Eksport plików nie jest publikacją w dane.gov.pl.</p>
      </footer>
    </>
  )
}
