import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react'
import { applySettings, DEFAULTS, FONT_SCALES, loadSettings, saveSettings } from './settings.js'

const Ctx = createContext(null)
export const useA11y = () => useContext(Ctx)

export function AccessibilityProvider({ children }) {
  const [settings, setSettings] = useState(loadSettings)
  useLayoutEffect(() => { applySettings(settings); saveSettings(settings) }, [settings])
  const update = useCallback((patch) => setSettings((s) => ({ ...s, ...patch })), [])
  const value = useMemo(() => ({
    settings, update, reset: () => setSettings({ ...DEFAULTS }),
    biggerFont: () => setSettings((s) => ({ ...s, size: Math.min(s.size + 1, FONT_SCALES.length - 1) })),
    smallerFont: () => setSettings((s) => ({ ...s, size: Math.max(s.size - 1, 0) })),
  }), [settings, update])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
