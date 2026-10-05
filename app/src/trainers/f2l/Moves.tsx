import { useState } from 'react'
import { createPortal } from 'react-dom'
import { SLOT_NAMES, algsById, getCase, getSlotCase, type CatalogAlg } from './catalog.ts'
import { TRIGGER_NAMES, type AlgTrigger } from '../../../../shared/cube.ts'
import type { AlgInsert } from '../../../../shared/f2l/catalog.ts'
import { Notation } from '../../common/notation/Notation.tsx'
import { notesFor, useProgress } from './progress.ts'

/**
 * A catalog alg's moves (see Notation), its marked triggers in parentheses. Hovering a
 * trigger shows a tooltip with its name; for the closing insert also the case it solves on
 * its own and the notes that case's alg shows (see notesFor).
 */
export function AlgMoves({ alg }: { alg: CatalogAlg }) {
  const [hovered, setHovered] = useState<{ trigger: AlgTrigger; anchor: DOMRect }>()
  if (!alg.triggers) return <Notation moves={alg.moves} />
  return (
    <>
      <Notation
        moves={alg.moves}
        triggers={alg.triggers}
        wrapTrigger={(trigger, content) => (
          // The empty title keeps the row's own tooltip (the full moves) from showing here.
          <span
            className="alg-trigger"
            title=""
            onPointerEnter={(e) => setHovered({ trigger, anchor: e.currentTarget.getBoundingClientRect() })}
            onPointerLeave={() => setHovered(undefined)}
          >
            {content}
          </span>
        )}
      />
      {hovered && createPortal(<TriggerTooltip alg={alg} {...hovered} />, document.body)}
    </>
  )
}

/**
 * Floats above the trigger (below it if there's no room), fixed to the viewport so the
 * alg row's clipping doesn't cut it off. Sits clear of the pointer: it never takes hover.
 */
function TriggerTooltip({ alg, trigger, anchor }: { alg: CatalogAlg; trigger: AlgTrigger; anchor: DOMRect }) {
  const moves = alg.moves.split(' ')
  const triggerMoves = moves.slice(trigger.start, trigger.start + trigger.length).join(' ')
  const style = {
    left: Math.max(8, Math.min(anchor.left, innerWidth - 328)),
    ...(anchor.top > 160 ? { bottom: innerHeight - anchor.top + 6 } : { top: anchor.bottom + 6 }),
  }
  const { insert } = alg
  const closing = insert && insert.kind === trigger.kind && trigger.start + insert.length === moves.length
  return (
    <div className="trigger-tooltip" role="tooltip" style={style}>
      <div className="trigger-tooltip-head">
        <strong>{TRIGGER_NAMES[trigger.kind]}</strong>
        <span className="trigger-tooltip-moves">{triggerMoves}</span>
      </div>
      {closing && <InsertDetails insert={insert} />}
    </div>
  )
}

/** The case the closing insert solves on its own, and that case's alg's notes. */
function InsertDetails({ insert }: { insert: AlgInsert }) {
  const { notes } = useProgress()
  const { slotCaseId, auf, algId } = insert
  const sc = getSlotCase(slotCaseId)
  const triggerAlg = algId ? algsById.get(algId) : undefined
  const triggerNotes = triggerAlg ? notesFor(notes, triggerAlg) : []
  return (
    <>
      <div className="trigger-tooltip-case">
        On its own it solves F2L {getCase(sc.caseId).number} · {SLOT_NAMES[sc.slot]}
        {auf && <>, after {auf}</>}
      </div>
      {triggerNotes.map((n) => (
        <p key={n.id} className="trigger-tooltip-note">
          {n.text}
        </p>
      ))}
    </>
  )
}
