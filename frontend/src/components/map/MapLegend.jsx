import { PIN_TONES } from '../../lib/labels.js'

/** Legenda kolorów pinezek: ten sam podział co na mapie (zielony, żółty, czerwony, znak zapytania). */
export default function MapLegend() {
  return (
    <>
    <ul className="legend" aria-label="Legenda kolorów punktów">
      {Object.values(PIN_TONES).map((t) => (
        <li key={t.cls}><span className={`pin pin-${t.cls}`} aria-hidden="true"><span>{t.icon}</span></span>{t.text}</li>
      ))}
    </ul>
    <p className="small muted legend-note">Okrąg z liczbą to punkty w okolicy – jego kolor pokazuje, jakiego rodzaju jest ich najwięcej. Przybliż mapę, aby je rozdzielić.</p>
    </>
  )
}
