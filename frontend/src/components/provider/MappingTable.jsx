/** Pola wzorca zajęte przez inne kolumny (lustro walidacji INVALID_MAPPING: jedno pole = jedna kolumna). */
export function usedTargets(mapping, exceptColumn) {
  return new Set(Object.entries(mapping).filter(([c, p]) => p && c !== exceptColumn).map(([, p]) => p))
}
export function hasDuplicateTargets(mapping) {
  const seen = new Set()
  for (const p of Object.values(mapping)) { if (!p) continue; if (seen.has(p)) return true; seen.add(p) }
  return false
}

const CONF = { wysoka: 'Wysoka', niska: 'Niska – sprawdź', brak: 'Brak dopasowania' }

/** Tabela mapowania kolumn jednego źródła. fields = pola wzorca (bez wyliczanych). */
export default function MappingTable({ source, fields, value, onChange }) {
  const prop = Object.fromEntries(source.proponowane_mapowanie.map((m) => [m.kolumna, m]))
  const kc = source.kontrola_naglowkow
  return (
    <section className="card" aria-label={`Mapowanie źródła ${source.nazwa}`}>
      <h3 style={{ marginTop: 0 }}>{source.nazwa} <span className="muted small">({source.nazwa_pliku}, {source.format.toUpperCase()}{source.kodowanie ? `, ${source.kodowanie}` : ''}{source.separator ? `, separator „${source.separator}”` : ''}, wierszy: {source.liczba_wierszy})</span></h3>
      {(kc.brakujace.length > 0 || kc.nadmiarowe.length > 0 || kc.powtorzone.length > 0) && (
        <div className="alert warn" role="status">
          {kc.brakujace.length > 0 && <p>Brakujące pola wymagane (po zmapowaniu): <strong>{kc.brakujace.join(', ')}</strong></p>}
          {kc.nadmiarowe.length > 0 && <p>Kolumny bez dopasowania (zostaną pominięte): {kc.nadmiarowe.join(', ')}</p>}
          {kc.powtorzone.length > 0 && <p>Powtórzone nagłówki (używana pierwsza kolumna): {kc.powtorzone.join(', ')}</p>}
        </div>
      )}
      <div className="table-wrap">
        <table>
          <caption className="sr-only">Mapowanie kolumn źródła na pola wzorca</caption>
          <thead><tr><th scope="col">Kolumna ze źródła</th><th scope="col">Pole wzorca</th><th scope="col">Pewność propozycji</th></tr></thead>
          <tbody>
            {source.proponowane_mapowanie.map((m, i) => {
              const taken = usedTargets(value, m.kolumna)
              const id = `map-${source.zrodlo_id}-${i}`
              return (
                <tr key={m.kolumna}>
                  <th scope="row" style={{ background: 'none', position: 'static' }}><label htmlFor={id}>{m.kolumna}</label></th>
                  <td>
                    <select id={id} value={value[m.kolumna] || ''} onChange={(e) => onChange({ ...value, [m.kolumna]: e.target.value || null })}>
                      <option value="">— pomiń —</option>
                      {fields.map((f) => <option key={f.nazwa} value={f.nazwa} disabled={taken.has(f.nazwa)}>{f.etykieta} ({f.nazwa}){taken.has(f.nazwa) ? ' – zajęte' : ''}</option>)}
                    </select>
                  </td>
                  <td><span className={`badge ${prop[m.kolumna].pewnosc === 'wysoka' ? 'ok' : prop[m.kolumna].pewnosc === 'niska' ? 'warn' : 'unk'}`}>{CONF[prop[m.kolumna].pewnosc]}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
