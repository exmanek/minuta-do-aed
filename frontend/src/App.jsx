import { Route, Routes } from 'react-router-dom'
import RequireProvider from './auth/RequireProvider.jsx'
import Layout from './components/common/Layout.jsx'
import MapPage from './pages/MapPage.jsx'
import NotFound from './pages/NotFound.jsx'
import ProviderAedFormPage from './pages/ProviderAedFormPage.jsx'
import ProviderAggregationPage from './pages/ProviderAggregationPage.jsx'
import ProviderLoginPage from './pages/ProviderLoginPage.jsx'
import ProviderMyAedPage from './pages/ProviderMyAedPage.jsx'
import StandardPage from './pages/StandardPage.jsx'

export default function App() {
  const guard = (el) => <RequireProvider>{el}</RequireProvider>
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<MapPage />} />
        <Route path="/standard" element={<StandardPage />} />
        <Route path="/dostawca/logowanie" element={<ProviderLoginPage />} />
        <Route path="/dostawca/agregacja" element={guard(<ProviderAggregationPage />)} />
        <Route path="/dostawca/dodaj" element={guard(<ProviderAedFormPage />)} />
        <Route path="/dostawca/punkty" element={guard(<ProviderMyAedPage />)} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
