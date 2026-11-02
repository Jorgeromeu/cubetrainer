// The catalog contract (catalog/f2l.json): written by catalog-builder, read by the app.
// See docs/requirements.md §5.1.
import type { AlgTrigger, Slot, TriggerKind } from "../cube.ts";

export interface Catalog {
  version: 1;
  generatedAt: string;
  caseSet: { id: string; name: string };
  /** Ordered for browsing: by lowest case number in the cluster. */
  clusters: Cluster[];
  cases: Case[];
  slotCases: SlotCase[];
  algs: CatalogAlg[];
}

export interface Cluster {
  /** e.g. "f2l-c-11-12", or "f2l-c-37" for a self-mirror case. */
  id: string;
  /** 1 or 2 case ids, ascending by number. */
  caseIds: string[];
}

export interface Case {
  /** e.g. "f2l-12" */
  id: string;
  number: number;
  clusterId: string;
  group: string;
  /** Partner case id; equals `id` for self-mirror cases. */
  mirrorCaseId: string;
}

export interface SlotCase {
  /** e.g. "f2l-12-FR" */
  id: string;
  caseId: string;
  slot: Slot;
  /** Face turns only, applied to a solved cube held with the cross on D. */
  setup: string;
  mirrorSlotCaseId: string;
  /**
   * Good edge (true): with the cube held as it is (no rotation), the pair's edge can be
   * solved with R/L/U/D turns alone. Bad edge (false): it needs an F/B quarter turn, or a
   * rotation first. Depends on the slot (a quarter turn swaps good and bad), but is the
   * same across an alg family: mirrors and the 180° turn keep it.
   */
  edgeOriented: boolean;
  /** Alg ids, best first. */
  algIds: string[];
}

export interface CatalogAlg {
  /** `${slotCaseId}-${hash of normalised moves}` */
  id: string;
  slotCaseId: string;
  moves: string;
  source: string;
  /** Position in the source's list (0 = top). */
  rank: number;
  votes?: number;
  stm?: number;
  etm?: number;
  /**
   * This alg's family: the same alg carried to each other slot, keyed by slot, where the
   * catalog has those exact moves. MIRROR_SLOT holds its left-right mirror and
   * FRONT_BACK_SLOT its front-back mirror (both on the mirror case); OPPOSITE_SLOT holds
   * it turned 180° (same case).
   */
  familyAlgIds?: Partial<Record<Slot, string>>;
  /**
   * The alg's shape: a hash of its local form, the alg as done at front-right with whole-
   * cube rotations taken out and wide/slice moves as face turns plus a rotation. Algs with
   * one shape are the same alg in another grip or slot (`y' U R' …` and `d R' …`; the
   * 180° turn). Content-derived, so it survives catalog rebuilds.
   */
  shapeId: string;
  /** The shape of the local form's mirror image: algs of the mirror case with that shape are its mirrors and transposes (see LinkKind). */
  mirrorShapeId: string;
  /** The side the local form mostly turns, R (with L) or F (with B), when one clearly dominates. */
  side?: "R" | "F";
  /**
   * The published recommendation sheets (RECOMMENDERS) with exactly these moves for this
   * slot-case. A sheet's alg that no other source spells that way is in the catalog with
   * the sheet as its `source`. (The app counts the same alg in other grips and slots as
   * recommended through it.)
   */
  recommendedBy?: Recommender[];
  /** The trigger the alg ends with, if it ends with one (see AlgInsert). */
  insert?: AlgInsert;
  /**
   * The alg's marked triggers, in order: its closing insert (see AlgInsert), or for an alg
   * written out in catalog-builder/data/triggers.json, its groups in parentheses there.
   * Only these are shown as triggers; nothing is detected from the moves.
   */
  triggers?: AlgTrigger[];
}

/**
 * Published recommendation sheets, collected by catalog-builder (fetch/parse-recommended).
 * J Perm's is for the front-right slot (its second column is the mirror case at FR, done
 * with a y and the left hand); CubeSkills' covers all four slots.
 */
export const RECOMMENDERS = {
  jperm: {
    name: "J Perm",
    sheet: "Best F2L Algorithms (2021)",
    url: "https://bit.ly/bestf2l",
  },
  cubeskills: {
    name: "CubeSkills",
    sheet: "F2L Algorithms – All Four Slot Angles, by Feliks Zemdegs and Andy Klise",
    url: "https://www.cubeskills.com/uploads/pdf/tutorials/f2l-algorithms-different-slot-positions.pdf",
  },
} as const;
export type Recommender = keyof typeof RECOMMENDERS;

/**
 * How two algs of a cluster relate, from their shapes (see CatalogAlg.shapeId). Not
 * stored: the app derives the links from shapeId and mirrorShapeId.
 * - rotation: the same shape, so the same alg in another grip or slot of the case (a
 *   rotation or a `d` move apart, or turned 180°);
 * - mirrorLR / mirrorFB: mirror-image shapes in the left-right / front-back neighbouring
 *   slot (on the mirror case);
 * - transpose: mirror-image shapes in the same slot (or the opposite one): the mirror case
 *   done with F-U moves instead of R-U ones (or the other way), not rotated.
 */
export const LINK_KINDS = ["mirrorLR", "mirrorFB", "rotation", "transpose"] as const;
export type LinkKind = (typeof LINK_KINDS)[number];

/** The kinds of trigger an alg can end with as its closing insert. */
export type InsertKind = Exclude<TriggerKind, "sexy">;

/**
 * The trigger an alg ends with: its last `length` moves, which on their own solve a
 * case into a slot (as the moves are written: after any rotation in the alg, that's the
 * slot it turns). An insert is `X U* X'` with X a side face. `R' F R F'` and `F R' F' R`
 * in any slot or mirror are named by their first move: R/L a sledgehammer, F/B a
 * hedgeslammer. Checked with cubing.js.
 */
export interface AlgInsert {
  kind: InsertKind;
  length: 3 | 4;
  /** The slot-case the trigger solves on its own, after `auf`. */
  slotCaseId: string;
  /** The AUF before the trigger in that case ("" for none). */
  auf: string;
  /** That slot-case's catalog alg with exactly `auf` + the trigger, if there is one. */
  algId?: string;
}
