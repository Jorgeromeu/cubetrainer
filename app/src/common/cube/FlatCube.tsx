// The flat stealth drawing of a cube: what cubing.js shows from straight on (same place,
// size and greys, so the player can swap in without a jump), plus the nearest layer's
// row of each side face as a thin strip around it, like hint stickers folded flat.
import type { KPattern } from 'cubing/kpuzzle'
import type { Slot } from '../../../../shared/cube.ts'
import { CAMERA_DISTANCE, LL_PIECES, SLOT_PAIR } from './cubeModel.ts'
import { stealthScreenColor, type Role } from './stealthCube.ts'

type Vec = [number, number, number]
export type Face = 'U' | 'L' | 'F' | 'R' | 'B' | 'D'
type Orbit = 'EDGES' | 'CORNERS' | 'CENTERS'

/** A straight-on view: the face pointing at the camera, and the one that's up on screen. */
export interface FlatView {
  toward: Face
  up: Face
}

/** x right, y up, z toward the front (cubing.js's frame). */
const NORMAL: Record<Face, Vec> = {
  U: [0, 1, 0],
  D: [0, -1, 0],
  R: [1, 0, 0],
  L: [-1, 0, 0],
  F: [0, 0, 1],
  B: [0, 0, -1],
}

/** Each orbit's positions, named by the faces of their stickers in order (cubing.js's Cube3D piece definitions). */
const PIECES: Record<Orbit, string[]> = {
  EDGES: ['UF', 'UR', 'UB', 'UL', 'DF', 'DR', 'DB', 'DL', 'FR', 'FL', 'BR', 'BL'],
  CORNERS: ['UFR', 'URB', 'UBL', 'ULF', 'DRF', 'DFL', 'DLB', 'DBR'],
  CENTERS: ['U', 'L', 'F', 'R', 'B', 'D'],
}

/** Grey per sticker colour (default frame: white on U, yellow on D). */
const FACE_ROLE: Record<Face, Role> = {
  U: 'white',
  F: 'greenBlue',
  B: 'greenBlue',
  R: 'redOrange',
  L: 'redOrange',
  D: 'lastLayer',
}

// cubing.js's camera and cube: a 20° vertical field of view in a square box, the cube
// scaled to 1/3 (cubies 1 unit wide, stickers 0.85 wide and 0.503 out from their cubie's
// centre). Drawing coordinates run -1..1 across the box, like the camera's.
const TAN_HALF_FOV = Math.tan((10 * Math.PI) / 180)
const SCALE = 1 / 3
const STICKER_WIDTH = 0.85
const STICKER_OUT = 1.503
const FACE_OUT = 1.5

/** Drawing units per cubie unit, on a plane `out` cubie units in front of the cube's centre. */
const perCubie = (out: number) => SCALE / ((CAMERA_DISTANCE - out * SCALE) * TAN_HALF_FOV)

const STICKER_STEP = perCubie(STICKER_OUT)
const STICKER_SIZE = STICKER_WIDTH * STICKER_STEP
const FACE_EDGE = FACE_OUT * perCubie(FACE_OUT)
/**
 * Half-widths of each layer's top as seen from the camera. cubing.js draws cubies as
 * translucent black boxes, so the gaps between stickers darken with every layer showing
 * through, while the rim only has the nearest one.
 */
const LAYER_EDGES = [FACE_OUT, FACE_OUT - 1, FACE_OUT - 2].map((out) => FACE_OUT * perCubie(out))
/** Between the face's outer stickers and its edge. */
const RIM = FACE_EDGE - STICKER_STEP - STICKER_SIZE / 2
// Side strips: thinner than a sticker, a small gap out from the face.
const STRIP_SIZE = STICKER_SIZE * 0.55
const STRIP_CENTRE = FACE_EDGE + 0.035 + RIM + STRIP_SIZE / 2

/** One translucent layer behind each side strip, as behind the face's rim. */
const STRIP_BACKINGS = (() => {
  const length = 2 * FACE_EDGE
  const depth = STRIP_SIZE + 2 * RIM
  const near = STRIP_CENTRE - depth / 2
  return [
    { x: -length / 2, y: -near - depth, width: length, height: depth },
    { x: -length / 2, y: near, width: length, height: depth },
    { x: -near - depth, y: -length / 2, width: depth, height: length },
    { x: near, y: -length / 2, width: depth, height: length },
  ]
})()

const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

/** Same masking as the 3D player (Cube.tsx): last layer black, the pair in its greys, the rest dimmed. */
function roleOf(orbit: Orbit, identity: number, face: Face, pairSlot: Slot, highlightPair: boolean): Role {
  if (orbit === 'CENTERS' ? identity === 5 : LL_PIECES.includes(identity)) return 'lastLayer'
  const pair = SLOT_PAIR[pairSlot]
  const isPair = (orbit === 'CORNERS' && identity === pair.corner) || (orbit === 'EDGES' && identity === pair.edge)
  return highlightPair && !isPair ? 'dim' : FACE_ROLE[face]
}

interface Props {
  /** The player's current state (setup, plus however far its alg has played). */
  pattern: KPattern
  /** Whose home corner + edge are the pair. */
  pairSlot: Slot
  highlightPair: boolean
  view: FlatView
}

export function FlatCube({ pattern, pairSlot, highlightPair, view }: Props) {
  const toward = NORMAL[view.toward]
  const up = NORMAL[view.up]
  const right = cross(up, toward)
  const rects: { x: number; y: number; w: number; h: number; fill: string }[] = []

  for (const orbit of Object.keys(PIECES) as Orbit[]) {
    const names = PIECES[orbit]
    const { pieces, orientation } = pattern.patternData[orbit]
    names.forEach((name, position) => {
      // A cubie's centre is the sum of its stickers' face normals (-1..1 per axis).
      const centre = [...name].reduce<Vec>((sum, f) => sum.map((v, i) => v + NORMAL[f as Face][i]) as Vec, [0, 0, 0])
      const identity = pieces[position]
      const identityName = names[identity]
      ;[...name].forEach((f, i) => {
        // The piece's sticker (i + orientation) shows on the position's face i.
        const shown = identityName[(i + orientation[position]) % name.length] as Face
        const fill = stealthScreenColor(roleOf(orbit, identity, shown, pairSlot, highlightPair))
        const normal = NORMAL[f as Face]
        const facing = dot(normal, toward)
        const across = dot(centre, right) * STICKER_STEP
        const down = -dot(centre, up) * STICKER_STEP
        if (facing === 1) {
          rects.push({ x: across - STICKER_SIZE / 2, y: down - STICKER_SIZE / 2, w: STICKER_SIZE, h: STICKER_SIZE, fill })
        } else if (facing === 0 && dot(centre, toward) === 1) {
          // A side sticker of the nearest layer: into the strip on that side.
          const [sideX, sideY] = [dot(normal, right), -dot(normal, up)]
          if (sideX !== 0)
            rects.push({ x: sideX * STRIP_CENTRE - STRIP_SIZE / 2, y: down - STICKER_SIZE / 2, w: STRIP_SIZE, h: STICKER_SIZE, fill })
          else rects.push({ x: across - STICKER_SIZE / 2, y: sideY * STRIP_CENTRE - STRIP_SIZE / 2, w: STICKER_SIZE, h: STRIP_SIZE, fill })
        }
      })
    })
  }

  return (
    <svg className="flat-cube" viewBox="-1 -1 2 2" aria-hidden>
      {LAYER_EDGES.map((edge) => (
        <rect key={edge} className="flat-cube-body" x={-edge} y={-edge} width={2 * edge} height={2 * edge} />
      ))}
      {STRIP_BACKINGS.map((r, i) => (
        <rect key={i} className="flat-cube-body" {...r} />
      ))}
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.fill} />
      ))}
    </svg>
  )
}
