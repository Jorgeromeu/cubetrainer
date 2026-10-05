import { SLOT_NAMES, slotCaseIdFor } from './catalog.ts'
import { STATUS_LABEL, statusOf, useProgress, type Status } from './progress.ts'

/** Small round mark: empty ring (none), filled blue (main chosen), half violet (learning), green check (learnt). */
export function StatusMark({ status, size = 14 }: { status: Status; size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} className={`status-mark ${status}`} aria-label={STATUS_LABEL[status]}>
      <circle cx="8" cy="8" r="6.5" />
      {status === 'learning' && <path className="half" d="M8 1.5a6.5 6.5 0 0 0 0 13z" />}
      {status === 'learnt' && <path d="M4.8 8.3 7 10.4l4.2-4.6" />}
    </svg>
  )
}

/** Slots as seen from above (back row on top), matching the slot icons and mirror map. */
const GRID_ORDER = ['BL', 'BR', 'FL', 'FR'] as const

/** A case's four slot-cases as a 2×2 top view, each cell coloured by its status. */
export function SlotStatusGrid({ caseId, label }: { caseId: string; label: string }) {
  const { bySlotCase } = useProgress()
  return (
    <span className="slot-status-grid" role="img" aria-label={`${label} progress by slot`}>
      {GRID_ORDER.map((slot) => {
        const status = statusOf(bySlotCase.get(slotCaseIdFor(caseId, slot)))
        return <span key={slot} className={status} title={`${label} · ${SLOT_NAMES[slot]}: ${STATUS_LABEL[status]}`} />
      })}
    </span>
  )
}

/** Learnt (green), learning (violet), then main alg only (blue), as one stacked bar. */
export function ProgressBar({ total, main, learning, learnt }: { total: number; main: number; learning: number; learnt: number }) {
  const pct = (n: number) => `${(n / total) * 100}%`
  return (
    <span className="progress-bar" aria-hidden>
      <span className="learnt" style={{ width: pct(learnt) }} />
      <span className="learning" style={{ width: pct(learning) }} />
      <span className="main" style={{ width: pct(main) }} />
    </span>
  )
}
