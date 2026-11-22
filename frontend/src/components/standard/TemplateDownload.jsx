import { templateUrl } from '../../api/standard.js'
export default function TemplateDownload() {
  return (
    <p><a className="btn primary" href={templateUrl} download>Pobierz wzorzec XLSX</a>{' '}
      <span className="muted small">Arkusz „Dane” służy do importu; zakładka „Przykładowe dane” zawiera fikcyjne wiersze demonstracyjne.</span></p>
  )
}
