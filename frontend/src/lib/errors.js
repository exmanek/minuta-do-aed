// ApiError.details -> komunikaty przy polach i lista do podsumowania.
export function fieldErrors(err) {
  const out = {}
  for (const d of err?.details || []) {
    if (d && d.pole && !out[d.pole]) out[d.pole] = d.komunikat || d.message || 'Niepoprawna wartość.'
  }
  return out
}
export function errorLines(err) {
  const lines = (err?.details || []).map((d) => (typeof d === 'string' ? d : [d.pole && `${d.pole}`, d.komunikat || d.message].filter(Boolean).join(': '))).filter(Boolean)
  return lines
}
export const errorMessage = (err) => err?.message || 'Wystąpił nieoczekiwany błąd.'
