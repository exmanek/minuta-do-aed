// Stan edytowanego mapowania: {zrodlo_id: {kolumna: pole|null}} z zatwierdzonego profilu albo z propozycji backendu.
export function mappingFromBatch(batch) {
  return Object.fromEntries(batch.zrodla.map((z) => [
    z.zrodlo_id,
    z.zatwierdzone_mapowanie || Object.fromEntries(z.proponowane_mapowanie.map((m) => [m.kolumna, m.pole])),
  ]))
}
