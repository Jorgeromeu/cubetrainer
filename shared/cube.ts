// Cube vocabulary shared by every trainer, the server and catalog-builder: F2L slots
// and the named triggers (move groups) that notation marks up.

export const SLOTS = ["FR", "FL", "BR", "BL"] as const;
export type Slot = (typeof SLOTS)[number];

export const MIRROR_SLOT: Record<Slot, Slot> = { FR: "FL", FL: "FR", BR: "BL", BL: "BR" };
/** Front <-> back mirror: like MIRROR_SLOT, it lands on the mirror case. */
export const FRONT_BACK_SLOT: Record<Slot, Slot> = { FR: "BR", BR: "FR", FL: "BL", BL: "FL" };
/** The diagonally opposite slot: the same case, seen after turning the cube 180° (y2). */
export const OPPOSITE_SLOT: Record<Slot, Slot> = { FR: "BL", BL: "FR", FL: "BR", BR: "FL" };

/**
 * The named triggers: the only move groups ever marked as triggers. Shapes (any slot or
 * mirror): an insert is `X U* X'` with X a side face; `R' F R F'` and `F R' F' R` are
 * named by their first move, R/L a sledgehammer, F/B a hedgeslammer; the sexy move is
 * `X U X' U'` or `X' U' X U`, U turning the way the side does (R U R' U', L' U' L U).
 */
export const TRIGGER_NAMES = {
  insert: "3-move insert",
  sledgehammer: "Sledgehammer",
  hedgeslammer: "Hedgeslammer",
  sexy: "Sexy move",
} as const;
export type TriggerKind = keyof typeof TRIGGER_NAMES;

/** A named trigger in an alg: moves `start` to `start + length - 1` (0-based). */
export interface AlgTrigger {
  kind: TriggerKind;
  start: number;
  length: 3 | 4;
}
