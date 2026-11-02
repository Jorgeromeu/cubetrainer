// Building blocks for the settings menu, so every trainer's section looks the same.
import type { ReactNode } from 'react'

export function SettingsSection({ title }: { title: string }) {
  return <div className="settings-section">{title}</div>
}

/** A labelled row; `hint` is the small line under the label. */
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
      {children}
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
