// How move sequences are marked up everywhere they're shown (algs, setups, scrambles, the
// player's move strip): whole-cube rotations stand out, and so do an alg's named triggers.
// Triggers are never guessed from the moves: only the catalog's marked ones are shown
// (CatalogAlg.triggers). Notation.tsx renders it.
import type { AlgTrigger } from '../../../../shared/cube.ts'
import { isRotation } from './moves.ts'

/** A run of moves shown together: a marked trigger, or a single plain move / rotation. */
export interface MoveGroup {
  moves: string[]
  trigger?: AlgTrigger
}

/** How one move is shown. */
export type MoveKind = 'turn' | 'rotation' | 'trigger'

/** Splits moves into groups around the marked triggers. */
export function groupMoves(moves: string[], triggers: readonly AlgTrigger[] = []): MoveGroup[] {
  const groups: MoveGroup[] = []
  for (let i = 0; i < moves.length; ) {
    const trigger = triggers.find((t) => t.start === i)
    const length = trigger?.length ?? 1
    groups.push({ moves: moves.slice(i, i + length), trigger })
    i += length
  }
  return groups
}

/** Each move's kind, in order (see groupMoves). */
export const moveKinds = (moves: string[], triggers: readonly AlgTrigger[] = []): MoveKind[] =>
  groupMoves(moves, triggers).flatMap((g) =>
    g.moves.map((m): MoveKind => (g.trigger ? 'trigger' : isRotation(m) ? 'rotation' : 'turn')),
  )

/** The moves in some text, split on whitespace. */
export const splitMoves = (moves: string) => moves.split(/\s+/).filter(Boolean)
