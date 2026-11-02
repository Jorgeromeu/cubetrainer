import type { ReactNode } from 'react'

interface Props {
  /** What's being stepped through: "scramble", "case". */
  noun: string
  onPrev: () => void
  onNext: () => void
  canPrev: boolean
  /** All off (e.g. while a timer runs). */
  disabled?: boolean
  /** More buttons after Next (link buttons: "Show case"…). */
  children?: ReactNode
}

/** A drill's ← and Next → (keys: keys.ts), then the trainer's own buttons. */
export function DrillNav({ noun, onPrev, onNext, canPrev, disabled = false, children }: Props) {
  return (
    <div className="drill-nav">
      <button className="drill-prev" onClick={onPrev} disabled={disabled || !canPrev} title={`Previous ${noun} (←)`} aria-label={`Previous ${noun}`}>
        ←
      </button>
      <button className="drill-next" onClick={onNext} disabled={disabled} title={`Next ${noun} (→)`}>
        Next →
      </button>
      {children}
    </div>
  )
}
