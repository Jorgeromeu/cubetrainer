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
