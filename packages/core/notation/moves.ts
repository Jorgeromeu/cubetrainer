// Small helpers on move notation, shared by the F2L catalog, alg text and the player.

/** A whole-cube rotation move: x, y or z, any amount. */
export const isRotation = (move: string) => /^[xyz][2']?$/.test(move)

/** The moves in some typed text, spaces optional ("RUR'" = R U R'); curly quotes count as primes. */
const moveTokens = (text: string) => text.replace(/[’‘`´]/g, "'").match(/[A-Za-z]w?\d*'?/g) ?? []

/**
 * Whether an alg's moves begin with the moves typed so far. Every typed move must match
 * exactly except the last, which may still be half typed (R matches R', R2, Rw) unless a
 * trailing space marks it done.
 */
export function startsWithMoves(moves: string, query: string): boolean {
  const typed = moveTokens(query)
  const alg = moveTokens(moves)
  const lastOpen = !/\s$/.test(query)
  return (
    typed.length <= alg.length &&
    typed.every((t, i) => (lastOpen && i === typed.length - 1 ? alg[i].startsWith(t) : alg[i] === t))
  )
}

/** The four U-layer turns that set the angle a case is seen at ("" for none). */
export const AUFS = ['', 'U', 'U2', "U'"]

/** The U turn that undoes an AUF from AUFS. */
export const undoAuf = (auf: string) => (auf === 'U' ? "U'" : auf === "U'" ? 'U' : auf)

const quarterTurns = (move: string) => (move.endsWith('2') ? 2 : move.endsWith("'") ? 3 : 1)

/** A move without its amount: the layers it turns ("Rw2" → "Rw", "U'" → "U"). */
const family = (move: string) => move.replace(/2?'?$/, '')

/** Joins move sequences, merging turns of the same layers where they meet (U + U' cancels, R + Rw doesn't). */
export function joinMoves(...parts: string[]): string {
  const out: string[] = []
  for (const move of parts.join(' ').split(/\s+/).filter(Boolean)) {
    const last = out.at(-1)
    if (last === undefined || family(last) !== family(move)) {
      out.push(move)
      continue
    }
    const turns = (quarterTurns(last) + quarterTurns(move)) % 4
    out.pop()
    if (turns) out.push(family(move) + ['', '', '2', "'"][turns])
  }
  return out.join(' ')
}
