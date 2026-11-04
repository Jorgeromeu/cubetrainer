// Building blocks for settings sections, so every section on the settings window looks the same.
import type { ReactNode } from 'react'

/** A heading inside a section, for a section with several groups of settings. */
export function SettingsSection({ title }: { title: string }) {
  return <div className="settings-section">{title}</div>
}

/** A setting's row: its label (and `hint`, the small line under it) on the left, its control on the right (below, when wide). */
export function Setting({ label, hint, disabled, children }: {
  label: string
  hint?: string
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <div className={'setting' + (disabled ? ' disabled' : '')}>
      <div className="setting-label">
        {label}
        {hint && <span>{hint}</span>}
      </div>
      <div className="setting-control">{children}</div>
    </div>
  )
}

/** A row of mutually exclusive buttons. */
export function Segmented<T>({ options, value, onChange }: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={String(o.value)} className={o.value === value ? 'active' : undefined} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

const ON_OFF = [
  { value: true, label: 'On' },
  { value: false, label: 'Off' },
]

export function OnOff({ value, onChange }: { value: boolean; onChange: (on: boolean) => void }) {
  return <Segmented options={ON_OFF} value={value} onChange={onChange} />
}
