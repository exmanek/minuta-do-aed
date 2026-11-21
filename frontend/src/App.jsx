import { NavLink, Route, Routes } from 'react-router-dom'
import DemoBanner from './components/common/DemoBanner.jsx'
import MapPage from './pages/MapPage.jsx'
import ProviderAggregationPage from './pages/ProviderAggregationPage.jsx'
import ProviderAedFormPage from './pages/ProviderAedFormPage.jsx'
import StandardPage from './pages/StandardPage.jsx'

export default function App() {
  return (
    <>
      <nav>
        <NavLink to="/" end>Mapa AED</NavLink>
        <NavLink to="/dostawca/agregacja">Import (dostawca)</NavLink>
        <NavLink to="/dostawca/dodaj">Dodaj AED</NavLink>
        <NavLink to="/standard">Standard danych</NavLink>
      </nav>
      <DemoBanner />
      <main>
        <Routes>
          <Route path="/" element={<MapPage />} />
          <Route path="/dostawca/agregacja" element={<ProviderAggregationPage />} />
          <Route path="/dostawca/dodaj" element={<ProviderAedFormPage />} />
          <Route path="/standard" element={<StandardPage />} />
          <Route path="*" element={<p>Nie znaleziono strony.</p>} />
        </Routes>
      </main>
    </>
  )
}
