// The PLL compare tool's API contract between server/ and app/: named sets of cubes,
// saved to load a comparison again (e.g. "Ra Rb T" or "Y V E").

/**
 * One cube on the board: a PLL case and two U turns, in quarter turns (0-3). Its setup is
 * `U^variant · case · U^turn`: `turn` spins the solved-up last layer (another angle, another
 * pattern), `variant` shifts its colours against the centres (the same pattern).
 */
export interface CompareCube {
  /** e.g. "pll-Ga" (catalog/pll.json) */
  caseId: string;
  variant: number;
  turn: number;
  /** Its annotations: sets of stickers, each in its own colour with a caption; missing if none. */
  blocks?: Block[];
}

/**
 * Some stickers of one cube (not necessarily touching), marked in one colour of the
 * palette (the app's, by index) and captioned. A cube has at most one block a colour, and
 * a sticker is in at most one block. Kept sorted: blocks by colour, stickers by name.
 */
export interface Block {
  color: number;
  caption: string;
  stickers: string[];
}

export const BLOCK_COLORS = 4;
export const MAX_CAPTION = 60;

/**
 * A sticker: its orbit's letter (edges, corners, middles) and its index there, piece × the
 * orbit's stickers a piece + the sticker, in cubing.js's 3x3x3 numbering. It's the sticker
 * itself, so a block moves with it when the cube is turned.
 */
export const STICKER_ORBITS = {
  e: { orbit: "EDGES", stickers: 2, pieces: 12 },
  c: { orbit: "CORNERS", stickers: 3, pieces: 8 },
  m: { orbit: "CENTERS", stickers: 1, pieces: 6 },
} as const;

export function isSticker(sticker: string): boolean {
  const match = /^([ecm])(\d{1,2})$/.exec(sticker);
  if (!match) return false;
  const { stickers, pieces } = STICKER_ORBITS[match[1] as keyof typeof STICKER_ORBITS];
  return Number(match[2]) < stickers * pieces;
}

export interface CompareSet {
  /** uuid, chosen by the client */
  id: string;
  /** Unique, ignoring case. */
  name: string;
  cubes: CompareCube[];
  /** ISO timestamps */
  createdAt: string;
  updatedAt: string;
}

export const MAX_SET_CUBES = 24;
export const MAX_SET_NAME = 80;

// GET /api/pll-compare/sets
export interface SetsResponse {
  /** By name. */
  sets: CompareSet[];
}

// PUT /api/pll-compare/sets/:id -> CompareSet. Creates or replaces it.
export interface PutSetBody {
  name: string;
  cubes: CompareCube[];
}

// DELETE /api/pll-compare/sets/:id -> null
