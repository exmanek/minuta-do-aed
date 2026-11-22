export default function ProviderGuide() {
  return (
    <section aria-labelledby="guide-h">
      <h2 id="guide-h">Jak udostępnić dane (krok po kroku)</h2>
      <ol>
        <li>Pobierz wzorzec XLSX i wypełnij arkusz „Dane” (lub użyj własnego CSV/JSON – kolumny zmapujemy w kroku 2).</li>
        <li>Zaloguj się w panelu dostawcy numerem REGON (sprawdzamy tylko format numeru, nie tożsamość podmiotu).</li>
        <li>Wgraj pliki i opisz każde źródło: licencja, podstawa prawa do udostępniania, podmiot zarządzający danymi i zakres referencyjny.</li>
        <li>Sprawdź mapowanie, raport walidacji i ewentualne duplikaty (nic nie jest scalane bez Twojej decyzji).</li>
        <li>Złóż oświadczenia i zatwierdź dane w prototypie, następnie pobierz paczkę. <strong>Publikację w dane.gov.pl wykonujesz samodzielnie</strong> – prototyp jej nie wykonuje.</li>
      </ol>
      <h3>Dostępność – cztery osobne aspekty</h3>
      <p>Godziny dostępności, fizyczny dostęp do urządzenia, ograniczenia dostępu i stan urządzenia zapisujemy osobno. Jeśli czegoś nie wiesz, wpisz „nieznana/nieznane/nieznany” – brak informacji nie oznacza niedostępności.</p>
      <h3>Aktualność – trzy daty</h3>
      <p>Data ostatniego potwierdzenia (tylko Twoje jawne działanie), ostatniej edycji i importu (ustawia system). Potwierdzenie starsze niż 12 miesięcy oznacza „do odświeżenia”.</p>
      <h3>Zastrzeżenia</h3>
      <p>Prawdziwość danych potwierdza dostawca oświadczeniem; prototyp nie weryfikuje, czy urządzenie fizycznie istnieje i działa. Treść oświadczeń jest robocza.</p>
    </section>
  )
}
