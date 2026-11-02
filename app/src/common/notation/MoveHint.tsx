// The app-wide move cheat sheet: hovering any move marked with data-move (Notation, the
// player's move strip…) shows an icon of what it does. One layer for the whole app
// (mounted in App.tsx), so anything showing a move only needs the attribute: data-move="R'".
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { moveInfo, type Axis, type MoveInfo } from '../../../../packages/core/notation/moveInfo.ts'

type Vec = [number, number, number]

const add = (...vs: Vec[]): Vec => vs.reduce((a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], [0, 0, 0])
const scale = (v: Vec, k: number): Vec => [v[0] * k, v[1] * k, v[2] * k]
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

const AXES: Record<Axis, Vec> = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }

/** The three faces seen (U, F, R), each with two axes across it. x is right, y up, z front. */
const FACES: { normal: Vec; u: Vec; v: Vec; shade: string }[] = [
  { normal: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1], shade: 'top' },
  { normal: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], shade: 'front' },
  { normal: [1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], shade: 'right' },
]

/** Isometric, seen from up-front-right. */
const project = ([x, y, z]: Vec): [number, number] => [(x - z) * Math.cos(Math.PI / 6), (x + z) * 0.5 - y]

const path = (points: Vec[]) =>
  points.map((p, i) => `${i ? 'L' : 'M'}${project(p).map((n) => n.toFixed(3)).join(' ')}`).join(' ')

/** An arrowhead at the end of a polyline, pointing along its last step. */
function arrowHead(points: Vec[]) {
  const [x1, y1] = project(points.at(-2)!)
  const [x2, y2] = project(points.at(-1)!)
  const len = Math.hypot(x2 - x1, y2 - y1) || 1
  const [dx, dy] = [(x2 - x1) / len, (y2 - y1) / len]
  const size = 0.42
  const back = [x2 - dx * size, y2 - dy * size]
  const left = [back[0] - dy * size * 0.6, back[1] + dx * size * 0.6]
  const right = [back[0] + dy * size * 0.6, back[1] - dx * size * 0.6]
  return `M${x2 + dx * 0.1} ${y2 + dy * 0.1} L${left.join(' ')} L${right.join(' ')} Z`
}

/** The arrows showing which way the turning stickers go, on each face seen. */
function arrows({ axis, layers, dir }: MoveInfo): Vec[][] {
  const a = AXES[axis]
  const omega = scale(a, dir)
  const centre = layers.reduce<number>((s, l) => s + l, 0) / layers.length
  const out: Vec[][] = []
  for (const { normal, u } of FACES) {
    const along = dot(normal, a)
    if (along === 0) {
      // A band across this face: a straight arrow along it, the way it moves.
      const d = cross(omega, normal)
      const steps = [-1.15, -0.4, 0.4, 1.15]
      out.push(steps.map((t) => add(scale(normal, 1.5), scale(a, centre), scale(d, t))))
    } else if (layers.includes(along > 0 ? 1 : -1)) {
      // This face turns itself: a round arrow on it.
      const w = cross(normal, u)
      const sense = dot(omega, normal) > 0 ? 1 : -1
      const points: Vec[] = []
      for (let k = 0; k <= 24; k++) {
        const theta = Math.PI * 0.75 + sense * (k / 24) * Math.PI * 1.45
        points.push(add(scale(normal, 1.5), scale(u, Math.cos(theta) * 0.85), scale(w, Math.sin(theta) * 0.85)))
      }
      out.push(points)
    }
  }
  return out
}

/** The cube seen from up-front-right, the turning layers marked and arrows for where they go. */
export function MoveIcon({ info, size = 88 }: { info: MoveInfo; size?: number }) {
  const a = AXES[info.axis]
  return (
    <svg
      // Rotations in their colour, as everywhere moves are shown (Notation.tsx).
      className={'move-icon' + (info.layers.length === 3 ? ' rotation' : '')}
      width={size} height={size} viewBox="-3.3 -3.35 6.6 6.7" aria-hidden>
      {FACES.flatMap(({ normal, u, v, shade }) =>
        [-1, 0, 1].flatMap((i) =>
          [-1, 0, 1].map((j) => {
            const centre = add(scale(normal, 1.5), scale(u, i), scale(v, j))
            const coord = dot(centre, a)
            const layer = Math.abs(coord) > 1.2 ? Math.sign(coord) : coord
            const moving = info.layers.includes(layer as -1 | 0 | 1)
            const g = 0.44
            const corners = [
              add(centre, scale(u, -g), scale(v, -g)),
              add(centre, scale(u, g), scale(v, -g)),
              add(centre, scale(u, g), scale(v, g)),
              add(centre, scale(u, -g), scale(v, g)),
            ]
            return (
              <path
                key={`${shade}${i}${j}`}
                d={path(corners) + ' Z'}
                className={`move-icon-sticker ${shade}${moving ? ' moving' : ''}`}
              />
            )
          }),
        ),
      )}
      {arrows(info).map((points, k) => (
        <g key={k} className="move-icon-arrow">
          <path d={path(points)} />
          <path d={arrowHead(points)} className="head" />
        </g>
      ))}
      {info.double && (
        <text x="2.75" y="-2.45" className="move-icon-double">
          ×2
        </text>
      )}
    </svg>
  )
}

interface Hovered {
  info: MoveInfo
  anchor: DOMRect
}

/** Shows the hint for whatever [data-move] is hovered, anywhere in the app. Mount once. */
export function MoveHintLayer() {
  const [hovered, setHovered] = useState<Hovered>()
  const current = useRef<Element | null>(null)

  useEffect(() => {
    let timer: number | undefined
    const clear = () => {
      clearTimeout(timer)
      current.current = null
      setHovered(undefined)
    }
    const onOver = (e: PointerEvent) => {
      const el = e.target instanceof Element ? e.target.closest('[data-move]') : null
      if (el === current.current) return
      clear()
      if (!el) return
      const info = moveInfo(el.getAttribute('data-move') ?? '')
      if (!info) return
      current.current = el
      // A short wait, so sweeping across an alg doesn't flash a hint per move.
      timer = window.setTimeout(() => {
        if (current.current !== el || !el.isConnected) return
        setHovered({ info, anchor: el.getBoundingClientRect() })
      }, 180)
    }
    const onOut = (e: PointerEvent) => {
      const to = e.relatedTarget instanceof Element ? e.relatedTarget : null
      if (current.current && !current.current.contains(to)) clear()
    }
    addEventListener('pointerover', onOver)
    addEventListener('pointerout', onOut)
    addEventListener('scroll', clear, true)
    addEventListener('pointerdown', clear)
    return () => {
      clear()
      removeEventListener('pointerover', onOver)
      removeEventListener('pointerout', onOut)
      removeEventListener('scroll', clear, true)
      removeEventListener('pointerdown', clear)
    }
  }, [])

  return hovered ? createPortal(<MoveHint {...hovered} />, document.body) : null
}

/** Below the move (above if there's no room), fixed to the viewport; never takes hover. Icon only; its words are for screen readers. */
function MoveHint({ info, anchor }: Hovered) {
  const size = 88
  const style = {
    left: Math.max(8, Math.min(anchor.left + anchor.width / 2 - size / 2 - 7, innerWidth - size - 22)),
    ...(anchor.bottom + size + 22 < innerHeight ? { top: anchor.bottom + 6 } : { bottom: innerHeight - anchor.top + 6 }),
  }
  return (
    <div className="move-hint" role="tooltip" aria-label={`${info.move}: ${info.name}, ${info.how}`} style={style}>
      <MoveIcon info={info} size={size} />
    </div>
  )
}
