import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useA11y } from '../../a11y/AccessibilityContext.jsx'
import { DEFAULTS, FONT_SCALES } from '../../a11y/settings.js'

function Toggle({ id, label, checked, onChange, hint }) {
  return (
    <div className="check">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <label htmlFor={id}>{label}{hint && <span className="muted small"> {hint}</span>}</label>
    </div>
  )
}

/** Rozwijane menu „Dostępność”: rozmiar czcionki, kontrast, podkreślenie linków, odstępy, mniej animacji, czcionka systemowa. */
export default function AccessibilityMenu() {
  const { settings: s, update, reset, biggerFont, smallerFont } = useA11y()
  const [open, setOpen] = useState(false)
  const wrap = useRef(null)
  const button = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); button.current?.focus() } }
    const onDown = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false) }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown) }
  }, [open])

  const changed = JSON.stringify(s) !== JSON.stringify(DEFAULTS)
  return (
    <div className="a11y" ref={wrap}>
      <button ref={button} type="button" className="a11y-toggle" aria-expanded={open} aria-controls="a11y-panel" onClick={() => setOpen((o) => !o)}>
        <span aria-hidden="true" className="a11y-icon">Aa</span><span className="a11y-label">Dostępność</span>
        {changed && <span className="sr-only"> (zmienione ustawienia)</span>}
      </button>
      {open && (
        <section id="a11y-panel" className="a11y-panel" aria-label="Ustawienia dostępności">
          <h2>Dostępność</h2>
          <div className="a11y-row">
            <span id="a11y-size-label" className="a11y-name">Rozmiar tekstu</span>
            <div className="a11y-size" role="group" aria-labelledby="a11y-size-label">
              <button type="button" onClick={smallerFont} disabled={s.size === 0} aria-label="Zmniejsz tekst">A−</button>
              <output aria-live="polite" className="mono">{FONT_SCALES[s.size]}%</output>
              <button type="button" onClick={biggerFont} disabled={s.size === FONT_SCALES.length - 1} aria-label="Powiększ tekst">A+</button>
            </div>
          </div>
          <div className="a11y-row">
            <span id="a11y-contrast-label" className="a11y-name">Kontrast</span>
            <div className="a11y-seg" role="group" aria-labelledby="a11y-contrast-label">
              <button type="button" aria-pressed={s.contrast === 'normal'} onClick={() => update({ contrast: 'normal' })}>Standardowy</button>
              <button type="button" aria-pressed={s.contrast === 'high'} onClick={() => update({ contrast: 'high' })}>Wysoki</button>
            </div>
          </div>
          <Toggle id="a11y-underline" label="Podkreśl linki" checked={s.underline} onChange={(v) => update({ underline: v })} />
          <Toggle id="a11y-spacing" label="Większe odstępy w tekście" checked={s.spacing} onChange={(v) => update({ spacing: v })} />
          <Toggle id="a11y-plain" label="Czcionka systemowa" hint="(prostsza w odczycie)" checked={s.plain} onChange={(v) => update({ plain: v })} />
          <Toggle id="a11y-still" label="Wyłącz animacje" checked={s.still} onChange={(v) => update({ still: v })} />
          <div className="a11y-foot">
            <button type="button" onClick={reset} disabled={!changed}>Przywróć domyślne</button>
            <Link to="/deklaracja-dostepnosci" onClick={() => setOpen(false)}>Deklaracja dostępności</Link>
          </div>
        </section>
      )}
    </div>
  )
}
