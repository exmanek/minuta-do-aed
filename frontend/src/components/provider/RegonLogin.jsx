import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { login } from '../../api/provider.js'
import { useAuth } from '../../auth/AuthContext.jsx'
import { isValidRegonFormat } from '../../lib/regon.js'
import ErrorSummary from '../common/ErrorSummary.jsx'
import Field from '../common/Field.jsx'

const MESSAGES = {
  INVALID_REGON: 'Numer REGON ma niepoprawny format (9 lub 14 cyfr z poprawną sumą kontrolną).',
  INVALID_CREDENTIALS: 'Błędny REGON lub hasło.',
  PROVIDER_NOT_VERIFIED: 'To konto nie zostało jeszcze zweryfikowane przez administratora.',
}

/** Logowanie dostawcy. Poprawny format REGON NIE jest potwierdzeniem tożsamości podmiotu. */
export default function RegonLogin() {
  const { signIn } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const [regon, setRegon] = useState('')
  const [haslo, setHaslo] = useState('')
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState(null)
  const [busy, setBusy] = useState(false)
  const clean = regon.replace(/\s|-/g, '')
  const regonHint = clean.length >= 9 ? (isValidRegonFormat(clean) ? 'Numer REGON ma poprawny format.' : 'Numer REGON ma niepoprawny format.') : null

  const submit = async (e) => {
    e.preventDefault()
    const errs = {}
    if (!clean) errs.regon = 'Podaj numer REGON.'
    else if (!isValidRegonFormat(clean)) errs.regon = MESSAGES.INVALID_REGON
    if (!haslo) errs.haslo = 'Podaj hasło.'
    setErrors(errs); setApiError(null)
    if (Object.keys(errs).length) return
    setBusy(true)
    try {
      const r = await login(clean, haslo)
      signIn(r.token, r.dostawca)
      nav(loc.state?.from || '/dostawca/agregacja', { replace: true })
    } catch (err) {
      setApiError({ ...err, message: MESSAGES[err.code] || err.message, details: [] })
    } finally { setBusy(false) }
  }
  return (
    <form onSubmit={submit} noValidate style={{ maxWidth: 440 }} aria-label="Logowanie dostawcy">
      <ErrorSummary error={apiError} />
      <Field id="login-regon" label="REGON dostawcy" error={errors.regon} warning={!errors.regon ? regonHint : null}
        hint="Dostawcą może być wyłącznie podmiot z numerem REGON. Sprawdzamy tylko format numeru, nie tożsamość.">
        <input type="text" inputMode="numeric" autoComplete="username" value={regon} onChange={(e) => setRegon(e.target.value)} />
      </Field>
      <Field id="login-haslo" label="Hasło" error={errors.haslo}>
        <input type="password" autoComplete="current-password" value={haslo} onChange={(e) => setHaslo(e.target.value)} />
      </Field>
      <button type="submit" className="primary" disabled={busy}>{busy ? 'Logowanie…' : 'Zaloguj'}</button>
      <p className="small muted">Prototyp: konta demo zakłada administrator (skrypt seed). Status „zweryfikowane” nadaje administrator, aplikacja nie sprawdza rejestrów.</p>
    </form>
  )
}
