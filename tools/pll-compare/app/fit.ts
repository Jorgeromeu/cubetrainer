// The board fits the window: every cube shows at once, as big as the space allows. The
// columns are whichever count gives the biggest cubes, unless chosen; narrow, it's one
// cube a row and the page scrolls. A card is its cube, the case name and a line per
// caption (as many as the most captioned cube has, so the rows line up).
import { useLayoutEffect, useState, type RefObject } from 'react'

/** Gap between cards (.cmp-board). */
export const GAP = 8
/** Under the cube (index.css: .cmp-name, .cmp-caption). */
export const NAME_HEIGHT = 26
export const CAPTION_HEIGHT = 22
const MIN_CUBE = 80

const narrow = () => matchMedia('(max-width: 640px)').matches

export interface Fit {
  columns: number
  /** A card's width: its cube's size. */
  width: number
}

/** The cube size for `n` cubes in `columns`, in a `w` × `h` board. */
function cubeSize(n: number, columns: number, w: number, h: number, below: number) {
  const rows = Math.ceil(n / columns)
  return Math.floor(Math.min((w - (columns - 1) * GAP) / columns, (h - (rows - 1) * GAP) / rows - below))
}

export function fitBoard(n: number, chosen: number | null, w: number, h: number, captions: number): Fit {
  const below = NAME_HEIGHT + captions * CAPTION_HEIGHT
  let columns = chosen ? Math.min(chosen, n) : 1
  if (!chosen)
    for (let c = 2; c <= n; c++) if (cubeSize(n, c, w, h, below) > cubeSize(n, columns, w, h, below)) columns = c
  return { columns, width: Math.max(MIN_CUBE, cubeSize(n, columns, w, h, below)) }
}

/** Fits `n` cubes, each with up to `captions` caption lines, refitting as the window or the board changes. */
export function useFit(board: RefObject<HTMLElement | null>, n: number, chosen: number | null, captions: number) {
  const [fit, setFit] = useState<Fit | null>(null)
  useLayoutEffect(() => {
    const el = board.current
    if (!el || !n) return
    const refit = () =>
      setFit(
        fitBoard(n, narrow() ? (chosen ?? 1) : chosen, el.clientWidth, narrow() ? Infinity : el.clientHeight, captions),
      )
    refit()
    const observer = new ResizeObserver(refit)
    observer.observe(el)
    return () => observer.disconnect()
  }, [board, n, chosen, captions])
  return n ? fit : null
}
