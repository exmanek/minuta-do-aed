import { Link } from 'react-router-dom'
import { buildReport } from '../a11y/contrast.js'
import tokensCss from '../styles/tokens.css?raw'
import a11yCss from '../styles/a11y.css?raw'

// Dane do uzupełnienia przez zespół – celowo widoczne, nie wymyślamy kontaktów ani dat wdrożenia.
const TODO = {
  email: '[adres e-mail zespołu – do uzupełnienia]',
  phone: '[telefon – do uzupełnienia]',
  published: '[data publikacji – do uzupełnienia po wdrożeniu]',
}
const DATE = '22 listopada 2026 r.'

export default function AccessibilityStatementPage() {
  const rows = buildReport(tokensCss, a11yCss) // wynik liczony na żywo z tokenów CSS, więc deklaracja nie rozjeżdża się ze stylami
  const themes = ['standardowy', 'wysoki kontrast'].map((t) => {
    const r = rows.filter((x) => x.theme === t)
    return { t, ok: r.filter((x) => x.pass).length, all: r.length, min: Math.min(...r.map((x) => x.ratio)) }
  })
  return (
    <article className="prose">
      <h1>Deklaracja dostępności</h1>
      <p>Deklaracja dotyczy aplikacji internetowej <strong>Minuta do AED</strong> – prototypu opracowanego w ramach zadania „Misja AED – Dane na ratunek” (HackNation 2026).</p>
      <ul className="plain">
        <li><strong>Data publikacji strony:</strong> <span className="todo">{TODO.published}</span></li>
        <li><strong>Data ostatniej istotnej aktualizacji:</strong> {DATE}</li>
        <li><strong>Data sporządzenia deklaracji:</strong> {DATE}</li>
      </ul>

      <h2>Stan dostępności</h2>
      <p>Aplikacja jest <strong>częściowo zgodna</strong> z wytycznymi WCAG 2.1 na poziomie AA. Powody braku pełnej zgodności opisano poniżej.</p>

      <h2>Treści i funkcje, które nie są w pełni dostępne</h2>
      <ul>
        <li><strong>Mapa interaktywna.</strong> Mapa jest elementem graficznym. Jej odpowiednikiem tekstowym jest lista punktów w panelu bocznym, z tymi samymi danymi (adres, miejsce w obiekcie, status, odległość). Skupiska punktów i pinezki nie były testowane z czytnikami ekranu.</li>
        <li><strong>Kafelki mapy OpenStreetMap.</strong> Nie mamy wpływu na ich kontrast ani na alternatywę tekstową.</li>
        <li><strong>Wskazywanie położenia na mapie w formularzu.</strong> Alternatywą są pozycja z GPS oraz ręczne wpisanie współrzędnych w zwijanej sekcji formularza.</li>
        <li><strong>Brak formalnego audytu i testów z osobami z niepełnosprawnościami.</strong> Nie przeprowadzono testów z czytnikami ekranu (np. NVDA, VoiceOver), więc nie wykluczamy nieprawidłowości, których nie wykryły testy automatyczne.</li>
      </ul>

      <h2>Udogodnienia</h2>
      <ul>
        <li>Menu „Dostępność” w pasku górnym: powiększanie tekstu (do 175%), wysoki kontrast, podkreślenie linków, większe odstępy w tekście, czcionka systemowa i wyłączenie animacji. Ustawienia są zapamiętywane w przeglądarce.</li>
        <li>Cała aplikacja działa z klawiatury; widoczny wskaźnik fokusu; link „Przejdź do treści”.</li>
        <li>Status punktu AED jest podawany tekstem i symbolem, nie tylko kolorem. Brak informacji jest oznaczony neutralnie („Brak danych”), a nie jako niedostępność.</li>
        <li>Pola formularzy mają powiązane etykiety, komunikaty błędów i opisy; kontrolki mają co najmniej 44 × 44 px; pola mają czcionkę nie mniejszą niż 16 px.</li>
        <li>Układ responsywny: komputer, tablet i telefon.</li>
      </ul>

      <h2>Kontrast kolorów</h2>
      <p>Pary kolorów interfejsu są sprawdzane automatycznie (progi WCAG 2.1: tekst 4,5:1, elementy graficzne i kontrolki 3:1). Wynik z bieżącej wersji stylów:</p>
      <div className="table-wrap">
        <table>
          <caption className="sr-only">Wynik sprawdzenia kontrastu</caption>
          <thead><tr><th scope="col">Motyw</th><th scope="col">Pary spełniające próg</th><th scope="col">Najniższy kontrast</th></tr></thead>
          <tbody>{themes.map((x) => (
            <tr key={x.t}><th scope="row">{x.t}</th><td className="mono">{x.ok} / {x.all}</td><td className="mono">{x.min.toFixed(2)}:1</td></tr>))}</tbody>
        </table>
      </div>
      <p className="small muted">Szczegółowy raport: <code>docs/raport-kontrastu.md</code> (polecenie <code>npm run a11y:contrast</code> w katalogu <code>frontend</code>). Test nie obejmuje kafelków mapy ani logo.</p>

      <h2>Informacje o sporządzeniu deklaracji</h2>
      <p>Deklarację sporządzono na podstawie samooceny zespołu oraz automatycznych testów (kontrast kolorów, testy komponentów: etykiety, role, obsługa klawiatury). Prototyp nie podlegał niezależnemu audytowi.</p>

      <h2>Informacje zwrotne i dane kontaktowe</h2>
      <p>Problemy z dostępnością aplikacji można zgłaszać: e-mail <span className="todo">{TODO.email}</span>, telefon <span className="todo">{TODO.phone}</span>. Tą drogą można też złożyć wniosek o udostępnienie niedostępnej treści w innej formie.</p>
      <p>Żądanie powinno zawierać imię i nazwisko, dane kontaktowe, wskazanie strony lub aplikacji oraz opis problemu i preferowaną formę odpowiedzi. Zgłoszenie powinno zostać rozpatrzone niezwłocznie, nie później niż w ciągu 7 dni; jeśli to niemożliwe, zgłaszający zostanie poinformowany o nowym terminie (nie dłuższym niż 2 miesiące).</p>

      <h2>Procedura wnioskowo-skargowa</h2>
      <p>Jeśli odpowiedź nie rozwiąże problemu, można złożyć skargę do podmiotu publicznego, a następnie wnieść sprawę do Rzecznika Praw Obywatelskich (<a href="https://www.rpo.gov.pl">www.rpo.gov.pl</a>, bezpłatna infolinia 800 676 676).</p>

      <p className="small muted">Aplikacja nie zastępuje numeru alarmowego 112. <Link to="/">Wróć do mapy</Link>.</p>
    </article>
  )
}
