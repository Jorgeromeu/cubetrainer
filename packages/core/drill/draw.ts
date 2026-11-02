// Random picks for drills.

export const pick = <T,>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)]

/** One of `ids`, avoiding `previous` when there's a choice. */
export const pickOther = (ids: readonly string[], previous?: string) =>
  ids.length ? pick(ids.length > 1 ? ids.filter((id) => id !== previous) : ids) : undefined

/**
 * The ids dealt in the current round (see pickInRounds): the newest dealt ones in `ids`,
 * back to a repeat or a full round. `history` is the ids dealt so far, oldest first.
 */
function currentRound(ids: readonly string[], history: readonly string[]): Set<string> {
  const pool = new Set(ids)
  const round = new Set<string>()
  for (let i = history.length - 1; i >= 0 && !round.has(history[i]) && round.size < pool.size; i--)
    if (pool.has(history[i])) round.add(history[i])
  return round
}

/**
 * One of `ids` in rounds: each comes up once, in random order, before any comes up again.
 * A new round never starts with the one just dealt. Changing `ids` midway carries on:
 * the ones already dealt this round wait.
 */
export function pickInRounds(ids: readonly string[], history: readonly string[]): string | undefined {
  const round = currentRound(ids, history)
  const left = round.size === ids.length ? ids : ids.filter((id) => !round.has(id))
  return pickOther(left, history.at(-1))
}

/** How far into its round of `pickInRounds` the newest id is: 1 for a round's first. */
export const roundPosition = (ids: readonly string[], history: readonly string[]) => currentRound(ids, history).size
