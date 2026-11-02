// Train: the slot-cases in the overview's selection (its legend filter, filter.ts), one at
// a time in rounds (each once, in random order, then again). The setup is always the
// front-right one at a random angle, then a y to bring the pair to its slot (whatever
// Settings → F2L says: it's the easy one to do on a real cube). Set it up, solve it, go
// on; R shows the alg. Rating how it went is shown but off for now: nothing is recorded.
import { useCallback, useEffect, useMemo } from 'react'
import { Cube } from '../../common/cube/Cube.tsx'
import { pick, pickInRounds, roundPosition } from '../../common/drill/draw.ts'
import { useDealt, type Draw } from '../../common/drill/dealt.ts'
import { DrillNav } from '../../common/drill/DrillNav.tsx'
import { isControl, isTextField, NEXT_KEYS, PREV_KEYS } from '../../common/drill/keys.ts'
import { Notation } from '../../common/notation/Notation.tsx'
import { AUFS, joinMoves, undoAuf } from '../../common/notation/moves.ts'
import type { AlgTrigger } from '../../../../shared/cube.ts'
import { SLOT_NAMES, caseSetup, catalog, getAlg, getCase, getSlotCase, type CatalogAlg } from './catalog.ts'
import { useF2lFilter } from './filter.ts'
import { notesOn, useProgress, type SlotCaseState, type UserAlg } from './progress.ts'
import { f2lHref } from './route.ts'
import { isFilter, useF2lSettings } from './settings.ts'

/** A slot-case dealt this session, at an angle (a U turn after its setup). */
interface Dealt {
  slotCaseId: string
  auf: string
  revealed?: boolean
}

/** Keys the alg player takes while it's showing (Cube.tsx): play/pause and stepping. */
const PLAYER_KEYS = [' ', 'ArrowLeft', 'ArrowRight']

/** How it went; shown, not recorded yet. */
const RATINGS = ['Knew it', 'Slow', "Didn't know"]

const drawFrom =
  (ids: readonly string[]): Draw<Dealt> =>
  (_, dealt) => {
    const slotCaseId = pickInRounds(
      ids,
      dealt.map((d) => d.slotCaseId),
    )
    return slotCaseId ? { slotCaseId, auf: pick(AUFS) } : undefined
  }

/** An alg to show: a catalog alg, or one of yours (no triggers marked). */
type ShownAlg = Pick<CatalogAlg, 'id' | 'moves' | 'triggers'>

/** The alg to show for a slot-case: your main (catalog or your own), else one you've learnt, else the catalog's best. */
function algFor(slotCaseId: string, progress: SlotCaseState | undefined, userAlgs: ReadonlyMap<string, UserAlg>): ShownAlg {
  const main = progress?.mainAlg
  if (main?.kind === 'catalog') return getAlg(main.id)
  const userMain = main?.kind === 'user' ? userAlgs.get(main.id) : undefined
  if (userMain) return userMain
  const learnt = progress?.algs.find((a) => a.status === 'learnt' && a.alg.kind === 'catalog')
  return getAlg(learnt?.alg.id ?? getSlotCase(slotCaseId).algIds[0])
}

/**
 * The alg as done from the case dealt: the catalog alg starts from the case's own angle,
 * so the dealt angle's U turn is undone first (merged into the alg's first U turn, if it
 * has one; its triggers move along).
 */
function algFromAngle(alg: ShownAlg, auf: string): { moves: string; triggers?: AlgTrigger[] } {
  const moves = joinMoves(undoAuf(auf), alg.moves)
  const shift = moves.split(' ').filter(Boolean).length - alg.moves.split(' ').length
  const triggers = alg.triggers?.map((t) => ({ ...t, start: t.start + shift })).filter((t) => t.start >= 0)
  return { moves, triggers }
}

/** The selection's slot-cases, in catalog order. */
function useSelection() {
  const { matches } = useF2lFilter()
  // Kept as a string so the same selection is the same array from render to render.
  const key = catalog.slotCases
    .map((sc) => sc.id)
    .filter(matches)
    .join()
  return useMemo(() => (key ? key.split(',') : []), [key])
}

export function TrainCrumb() {
  const ids = useSelection()
  const { active } = useF2lFilter()
  const settings = useF2lSettings()
  const saved = active ? settings.savedFilters.find((f) => isFilter(settings, f)) : undefined
  return (
    <nav className="crumb">
      <a href={f2lHref({})} className="back" title="All cases">
        ← <span>All cases</span>
      </a>
      <h1>Train</h1>
      {saved && <span className="tag">{saved.name}</span>}
      <span className="tag" title={active ? 'The overview legend’s filter' : 'No filter on the overview: everything'}>
        {ids.length} slot-cases
      </span>
    </nav>
  )
}

export function Train() {
  const ids = useSelection()
  const { bySlotCase, userAlgs, notes } = useProgress()
  const { dealt, entry, pos, deal, prev, next: historyNext, update } = useDealt(drawFrom(ids))

  const next = useCallback(() => historyNext(drawFrom(ids)), [historyNext, ids])
  const reveal = useCallback(() => update((e) => ({ ...e, revealed: !e.revealed })), [update])

  // The selection changed (progress loaded, a filter changed) and the case shown left it: deal another.
  useEffect(() => {
    if (entry ? !ids.includes(entry.slotCaseId) : ids.length) deal(drawFrom(ids))
  }, [entry, ids, deal])

  const revealed = !!entry?.revealed
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || isTextField(e.target)) return
      if (revealed && PLAYER_KEYS.includes(e.key)) return
      if (e.key === 'r') {
        e.preventDefault()
        reveal()
      } else if (isControl(e.target)) {
        return
      } else if (NEXT_KEYS.includes(e.key) || e.key === ' ') {
        e.preventDefault()
        next()
      } else if (PREV_KEYS.includes(e.key)) {
        e.preventDefault()
        prev()
      }
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [next, prev, reveal, revealed])

  if (!entry) {
    return (
      <main className="f2l-train">
        <section className="drill">
          <p className="drill-empty">
            Nothing in the selection. Pick what to train with the legend on the <a href={f2lHref({})}>overview</a>.
          </p>
        </section>
      </main>
    )
  }

  const slotCase = getSlotCase(entry.slotCaseId)
  const { setup: moves, pairSlot } = caseSetup(slotCase, 'rotation', entry.auf)
  const alg = algFor(slotCase.id, bySlotCase.get(slotCase.id), userAlgs)
  // Your main may have no moves yet (just notes): then the notes are the answer.
  const played = alg.moves ? algFromAngle(alg, entry.auf) : { moves: '' }
  const placeholderNotes = alg.moves ? [] : notesOn(notes, { kind: 'user', id: alg.id })
  const caseName = `F2L ${getCase(slotCase.caseId).number} · ${SLOT_NAMES[slotCase.slot]}`
  const inRound = roundPosition(
    ids,
    dealt.slice(0, pos + 1).map((d) => d.slotCaseId),
  )

  return (
    <main className="f2l-train">
      <section className="drill">
        <div className="drill-moves" aria-live="polite" title="Set this up on your cube (cross on the bottom)">
          <Notation moves={moves} />
        </div>

        <div className="f2l-train-stage" data-reveal>
          {entry.revealed ? (
            <>
              <a
                className="f2l-train-answer"
                href={f2lHref({ clusterId: getCase(slotCase.caseId).clusterId, slotCaseId: slotCase.id, algId: alg.id })}
              >
                <strong>{caseName}</strong>
              </a>
              {!alg.moves && (
                <div className="f2l-train-placeholder">
                  <p>Your main alg here has no moves yet.</p>
                  {placeholderNotes.map((n) => (
                    <p key={n.id} className="f2l-train-note">
                      {n.text}
                    </p>
                  ))}
                </div>
              )}
              <Cube
                setup={moves}
                alg={played.moves}
                triggers={played.triggers}
                slot={slotCase.slot}
                pairSlot={pairSlot}
                size={300}
                interactive
                zoomable
              />
            </>
          ) : (
            <>
              <Cube setup={moves} slot={slotCase.slot} pairSlot={pairSlot} size={300} interactive controls={false} zoomable />
              <p className="f2l-train-hint">Set it up, solve it, then Next. Drag to turn the cube, scroll to zoom; R shows the alg.</p>
            </>
          )}
          <div className="f2l-train-rating" role="group" aria-label="How it went (not recorded yet)" title="Not recorded yet">
            {RATINGS.map((r) => (
              <button key={r} disabled>
                {r}
              </button>
            ))}
            <span>not recorded yet</span>
          </div>
        </div>

        <div className="drill-controls">
          <DrillNav noun="case" onPrev={prev} onNext={next} canPrev={pos > 0}>
            <button className="link-button" onClick={reveal} title="R">
              {entry.revealed ? 'Hide alg' : 'Show alg'}
            </button>
          </DrillNav>
          <span className="f2l-train-round" title="Each slot-case once, in random order, then a new round">
            <strong>{inRound}</strong> / {ids.length} this round
          </span>
        </div>

        <p className="drill-keys">
          {entry.revealed ? (
            <>
              <kbd>Enter</kbd>
              <kbd>N</kbd> next <kbd>P</kbd> back <kbd>R</kbd> hide alg <kbd>Space</kbd> play <kbd>←</kbd>
              <kbd>→</kbd> step
            </>
          ) : (
            <>
              <kbd>Space</kbd>
              <kbd>→</kbd> next <kbd>←</kbd> back <kbd>R</kbd> show alg
            </>
          )}
        </p>
      </section>
    </main>
  )
}
