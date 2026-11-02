// What a single move does, for the app-wide move hint (MoveHint.tsx): which layers turn,
// about which axis and which way, and a short description. Covers face turns (R), wide
// turns (Rw, r), slices (M E S) and rotations (x y z), each plain, primed or doubled.

export type Axis = 'x' | 'y' | 'z'

/** A layer along its axis: -1 (L, D, B side), 0 (middle) or 1 (R, U, F side). */
export type Layer = -1 | 0 | 1

export interface MoveInfo {
  move: string
  axis: Axis
  layers: Layer[]
  /** Which way it turns about the axis's positive direction (right-hand rule); a half turn shows its clockwise way. */
  dir: 1 | -1
  double: boolean
  /** Its name, e.g. "Right face". */
  name: string
  /** How it turns, e.g. "clockwise, seen from the right". */
  how: string
}

interface Base {
  axis: Axis
  layers: Layer[]
  /** The clockwise turn's sign about the axis (clockwise seen from that side). */
  sign: 1 | -1
  name: string
  /** The side it's seen from for "clockwise", or the face it turns like. */
  seenFrom: string
  likeFace?: string
}

const FACES: Record<string, Base> = {
  R: { axis: 'x', layers: [1], sign: -1, name: 'Right face', seenFrom: 'the right' },
  L: { axis: 'x', layers: [-1], sign: 1, name: 'Left face', seenFrom: 'the left' },
  U: { axis: 'y', layers: [1], sign: -1, name: 'Top face', seenFrom: 'above' },
  D: { axis: 'y', layers: [-1], sign: 1, name: 'Bottom face', seenFrom: 'below' },
  F: { axis: 'z', layers: [1], sign: -1, name: 'Front face', seenFrom: 'the front' },
  B: { axis: 'z', layers: [-1], sign: 1, name: 'Back face', seenFrom: 'the back' },
}

const SLICES: Record<string, Base> = {
  M: { axis: 'x', layers: [0], sign: 1, name: 'Middle slice', seenFrom: 'the left', likeFace: 'L' },
  E: { axis: 'y', layers: [0], sign: 1, name: 'Equator slice', seenFrom: 'below', likeFace: 'D' },
  S: { axis: 'z', layers: [0], sign: -1, name: 'Standing slice', seenFrom: 'the front', likeFace: 'F' },
}

const ROTATIONS: Record<string, Base> = {
  x: { axis: 'x', layers: [-1, 0, 1], sign: -1, name: 'Whole cube', seenFrom: 'the right', likeFace: 'R' },
  y: { axis: 'y', layers: [-1, 0, 1], sign: -1, name: 'Whole cube', seenFrom: 'above', likeFace: 'U' },
  z: { axis: 'z', layers: [-1, 0, 1], sign: -1, name: 'Whole cube', seenFrom: 'the front', likeFace: 'F' },
}

/** What a move does, or undefined if it isn't one ("R", "r", "Rw", "M'", "y2"…). */
export function moveInfo(move: string): MoveInfo | undefined {
  const m = /^([URFDLBurfdlbMESxyz])(w?)(2?)('?)$/.exec(move.replace(/[’‘`´]/g, "'"))
  if (!m) return undefined
  const [, letter, w, double, prime] = m
  const upper = letter.toUpperCase()
  const wide = !!w || (letter !== upper && upper in FACES)
  if (w && !(letter in FACES)) return undefined

  let base: Base
  if (letter in ROTATIONS) base = ROTATIONS[letter]
  else if (letter in SLICES) base = SLICES[letter]
  else if (wide) {
    const face = FACES[upper]
    base = { ...face, layers: [face.layers[0], 0], name: `${face.name} + middle (two layers)` }
  } else base = FACES[letter]

  const dir = prime && !double ? (-base.sign as 1 | -1) : base.sign
  const amount = double ? 'half turn (180°)' : prime ? 'counter-clockwise' : 'clockwise'
  const how = base.likeFace
    ? double
      ? `half turn, like ${base.likeFace}2`
      : `like ${base.likeFace}${prime ? "'" : ''} (${amount}, seen from ${base.seenFrom})`
    : double
      ? amount
      : `${amount}, seen from ${base.seenFrom}`
  return { move, axis: base.axis, layers: base.layers, dir, double: !!double, name: base.name, how }
}
