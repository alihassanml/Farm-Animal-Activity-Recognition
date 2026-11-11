interface Tab<T extends string> {
  value: T
  label: string
  count?: number
}

export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: Tab<T>[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-4 border-b border-line">
      {tabs.map((t) => {
        const active = t.value === value
        return (
          <button
            key={t.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={`-mb-px flex h-11 items-center gap-2 border-b-2 text-sm font-medium transition-colors duration-150 ${
              active ? 'border-ink text-ink' : 'border-transparent text-secondary hover:text-ink'
            }`}
          >
            {t.label}
            {t.count !== undefined && <span className="numeric text-xs text-muted">{t.count}</span>}
          </button>
        )
      })}
    </div>
  )
}
