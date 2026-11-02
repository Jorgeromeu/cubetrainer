// Scrambles for the PLL trainer: one of the case's scrambles (the inverse of one of its
// algs), with a random AUF before and after so the case shows up at any angle.
import { pick } from '../../../../packages/core/drill/draw.ts'
import { AUFS, joinMoves } from '../../../../packages/core/notation/moves.ts'
import type { PllCase } from './catalog.ts'

export interface PllScramble {
  caseId: string
  moves: string
}

/** A scramble for one of `cases`, avoiding the case of `previous` when there's a choice. */
export function nextScramble(cases: PllCase[], previous?: PllScramble): PllScramble | undefined {
  if (!cases.length) return undefined
  const pool = cases.length > 1 ? cases.filter((c) => c.id !== previous?.caseId) : cases
  const chosen = pick(pool)
  return { caseId: chosen.id, moves: joinMoves(pick(AUFS), pick(chosen.scrambles), pick(AUFS)) }
}
