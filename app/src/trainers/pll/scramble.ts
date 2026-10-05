// Scrambles for the PLL trainer: one of the case's scrambles (the inverse of one of its
// algs), with a random AUF before and after so the case shows up at any angle.
import type { PllCase } from './catalog.ts'

const AUFS = ['', 'U', 'U2', "U'"]

const pick = <T,>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)]

const quarterTurns = (move: string) => (move.endsWith('2') ? 2 : move.endsWith("'") ? 3 : 1)

/** Joins move sequences, merging turns of the same face where they meet (U + U' cancels). */
function joinMoves(...parts: string[]): string {
  const out: string[] = []
  for (const move of parts.join(' ').split(/\s+/).filter(Boolean)) {
    const last = out.at(-1)
    if (last?.[0] !== move[0]) {
      out.push(move)
      continue
    }
    const turns = (quarterTurns(last) + quarterTurns(move)) % 4
    out.pop()
    if (turns) out.push(move[0] + ['', '', '2', "'"][turns])
  }
  return out.join(' ')
}

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
