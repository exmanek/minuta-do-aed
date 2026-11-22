/** Pojawia się, gdy odpowiedź API zawiera dane_przykladowe: true. */
export default function DemoBanner({ visible = true }) {
  if (!visible) return null
  return <div className="banner" role="note">Wyświetlane dane są <strong>przykładowe i fikcyjne</strong> (prototyp). Nie przedstawiają prawdziwych urządzeń ani podmiotów.</div>
}
