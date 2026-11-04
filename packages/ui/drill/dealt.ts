// What drills share: a history of the items dealt this session, walked with ← and →.
// Going forward past the newest deals a new one. A tool brings its own draw (which
// items, what each holds) and its own entry type (a scramble, a case, plus what happened).
import { useCallback, useState } from 'react'

/** How many dealt items ← can go back through. */
const HISTORY = 200

/** Draws the next entry, given the newest one so far; undefined when there's nothing to draw from. */
export type Draw<E> = (previous: E | undefined, dealt: readonly E[]) => E | undefined

export function useDealt<E extends object>(initial: Draw<E>) {
  const [{ dealt, pos }, setHistory] = useState<{ dealt: E[]; pos: number }>(() => {
    const first = initial(undefined, [])
    return { dealt: first ? [first] : [], pos: 0 }
  })
  const atEnd = pos >= dealt.length - 1

  /** Deals a new entry at the end of the history (after `update`, if given) and goes to it. */
  const deal = useCallback(
    (draw: Draw<E>, update?: (dealt: E[]) => E[]) =>
      setHistory(({ dealt, pos }) => {
        const updated = update ? update(dealt) : dealt
        const entry = draw(updated.at(-1), updated)
        if (!entry) return { dealt: updated, pos }
        const all = [...updated, entry].slice(-HISTORY)
        return { dealt: all, pos: all.length - 1 }
      }),
    [],
  )

  /** Forward through the history, or a new entry drawn with `draw` at its end. */
  const next = useCallback(
    (draw: Draw<E>) => {
      if (atEnd) deal(draw)
      else setHistory((h) => ({ ...h, pos: h.pos + 1 }))
    },
    [atEnd, deal],
  )

  const prev = useCallback(() => setHistory((h) => ({ ...h, pos: Math.max(0, h.pos - 1) })), [])

  /** Changes the entry being shown. */
  const update = useCallback(
    (change: (entry: E) => E) => setHistory(({ dealt, pos }) => ({ dealt: dealt.with(pos, change(dealt[pos])), pos })),
    [],
  )

  return { dealt, pos, entry: dealt[pos] as E | undefined, atEnd, deal, next, prev, update }
}
