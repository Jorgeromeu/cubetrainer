// A PLL case seen from above: the last layer's face, each side's top row folded out
// around it, and arrows for where the pieces go. Plain SVG, no cubing.js.
import { useStealth } from '../../common/stealth.ts'
import { stealthScreenColor } from '../../common/cube/stealthCube.ts'
import type { PllCase } from './catalog.ts'

type Face = 'U' | 'F' | 'R' | 'B' | 'L'

// Held with yellow up and green in front (white cross on D, as for F2L).
const COLORS: Record<Face, string> = {
  U: '#ffd500',
  F: '#00a651',
  R: '#ff7a00',
  B: '#1f5fd6',
  L: '#d6192e',
}

// Stealth: last layer black as on the F2L cubes, the four sides as four distinct greys
// (PLL is read from the side colours, so opposite faces must still differ).
const STEALTH_COLORS: Record<Face, string> = {
  U: stealthScreenColor('lastLayer'),
  F: '#a0a0a0',
  B: '#d4d4d4',
  R: '#454545',
  L: '#707070',
}

// Layout, in top-sticker units: the 3x3 face from 0.6 to 3.6, side strips around it.
const STRIP = 0.42
const GAP = 0.08
const FACE = STRIP + GAP + 0.1
const SIZE = 2 * FACE + 3
const INSET = 0.06

/** Box of grid cell (col, row) in the 5x5 sticker grid. */
function cellBox(col: number, row: number) {
  const span = (i: number) =>
    i === 0 ? [0, STRIP] : i === 4 ? [SIZE - STRIP, STRIP] : [FACE + (i - 1), 1]
  const [x, w] = span(col)
  const [y, h] = span(row)
  return { x: x + INSET, y: y + INSET, w: w - 2 * INSET, h: h - 2 * INSET }
}

/** Centre of a top-face sticker. */
const centre = ([col, row]: [number, number]) => [FACE + col + 0.5, FACE + row + 0.5]

/** A line from `a` to `b`, pulled in at both ends, with heads where asked. */
function arrowPath(from: [number, number], to: [number, number], both: boolean) {
  const [x1, y1] = centre(from)
  const [x2, y2] = centre(to)
  const len = Math.hypot(x2 - x1, y2 - y1)
  const [ux, uy] = [(x2 - x1) / len, (y2 - y1) / len]
  const pull = 0.22
  const [sx, sy, ex, ey] = [x1 + ux * pull, y1 + uy * pull, x2 - ux * pull, y2 - uy * pull]
  const head = (tx: number, ty: number, dx: number, dy: number) => {
    const [bx, by] = [tx - dx * 0.3, ty - dy * 0.3]
    return `M${tx} ${ty}L${bx - dy * 0.17} ${by + dx * 0.17}L${bx + dy * 0.17} ${by - dx * 0.17}Z`
  }
  return {
    line: `M${both ? sx + ux * 0.2 : sx} ${both ? sy + uy * 0.2 : sy}L${ex - ux * 0.2} ${ey - uy * 0.2}`,
    heads: head(ex, ey, ux, uy) + (both ? head(sx, sy, -ux, -uy) : ''),
  }
}

export function PllIcon({ pll, size = 96 }: { pll: PllCase; size?: number }) {
  const stealth = useStealth()
  const colors = stealth ? STEALTH_COLORS : COLORS
  const rows = pll.stickers.split('/')
  return (
    <svg className="pll-icon" viewBox={`0 0 ${SIZE} ${SIZE}`} width={size} height={size} aria-hidden>
      <rect className="pll-icon-body" x={FACE - 0.04} y={FACE - 0.04} width={3.08} height={3.08} rx={0.12} />
      {rows.flatMap((row, r) =>
        [...row].map((face, c) => {
          if (face === '.') return null
          const { x, y, w, h } = cellBox(c, r)
          return <rect key={`${r}-${c}`} x={x} y={y} width={w} height={h} rx={0.08} fill={colors[face as Face]} />
        }),
      )}
      <g className="pll-arrows">
        {pll.arrows.map((a, i) => {
          const { line, heads } = arrowPath(a.from, a.to, !!a.both)
          return (
            <g key={i}>
              <path d={line} className="pll-arrow-line" />
              <path d={heads} className="pll-arrow-head" />
            </g>
          )
        })}
      </g>
    </svg>
  )
}
