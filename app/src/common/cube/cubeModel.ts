// What sits where on the cube for a case, shared by the 3D player (Cube.tsx) and the
// flat stealth drawing (FlatCube.tsx).
import type { Slot } from '../../../../shared/cube.ts'

// Catalog moves assume the cross on D. The player's default orientation has white on
// U, so every setup is prefixed with z2: white cross on the bottom, green in front.
export const HOLD_CROSS_ON_D = 'z2'

// Sticker masks follow piece identity (not position), indexed in cubing.js's default
// frame. After z2, the last-layer pieces are the ones that start on D (edges 4-7,
// corners 4-7, center 5), so the built-in "F2L" stickering (which masks U pieces)
// can't be used. Each slot's pair is the corner + edge whose home is that slot.
export const LL_PIECES = [4, 5, 6, 7]
export const SLOT_PAIR: Record<Slot, { corner: number; edge: number }> = {
  FR: { corner: 3, edge: 9 },
  FL: { corner: 0, edge: 8 },
  BR: { corner: 2, edge: 11 },
  BL: { corner: 1, edge: 10 },
}

/** Closer than cubing.js's default (6), so the cube fills more of its box. */
export const CAMERA_DISTANCE = 5
