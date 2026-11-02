import type { SlotCase } from './catalog.ts'

const EDGE_HINT = {
  good: 'Good edge: inserts with R/L/U/D moves, no rotation needed',
  bad: 'Bad edge: needs an F/B move, or a rotation first',
}

/** Pill saying whether the slot-case's edge is good (no rotation needed) or bad. */
export function EdgeTag({ slotCase }: { slotCase: SlotCase }) {
  const kind = slotCase.edgeOriented ? 'good' : 'bad'
  return (
    <span className={`edge-tag ${kind}`} title={EDGE_HINT[kind]}>
      {kind} edge
    </span>
  )
}
