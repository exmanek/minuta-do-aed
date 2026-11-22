/** Zakładki (role=tablist). Obsługa strzałek. */
export default function Tabs({ tabs, value, onChange, label }) {
  const onKey = (e, i) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const n = (i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length
    onChange(tabs[n].id)
    document.getElementById(`tab-${tabs[n].id}`)?.focus()
  }
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((t, i) => (
        <button key={t.id} id={`tab-${t.id}`} role="tab" type="button" aria-selected={value === t.id}
          tabIndex={value === t.id ? 0 : -1} onClick={() => onChange(t.id)} onKeyDown={(e) => onKey(e, i)}>{t.label}</button>
      ))}
    </div>
  )
}
