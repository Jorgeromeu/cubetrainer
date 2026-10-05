// The user-data API contract between server/ and app/. See docs/requirements.md §5.2.

/**
 * Which alg a slot-case's main alg is. Catalog algs live in catalog/f2l.json; user algs
 * (custom algs the user adds, not implemented yet) live in the user_algs table.
 */
export interface AlgRef {
  kind: "catalog" | "user";
  id: string;
}

/** A slot-case's main alg. Slot-cases without a main alg have no row. */
export interface SlotCaseProgress {
  slotCaseId: string;
  mainAlg: AlgRef;
  /** ISO timestamp */
  updatedAt: string;
}

/** Where you are with an alg. Independent of which alg is main. */
export const ALG_STATUSES = ["learning", "learnt"] as const;
export type AlgStatus = (typeof ALG_STATUSES)[number];

/** Your status for one alg. Algs without one have no entry. Main is separate (SlotCaseProgress). */
export interface AlgState {
  alg: AlgRef;
  slotCaseId: string;
  status: AlgStatus;
  /** ISO timestamp */
  updatedAt: string;
}

/**
 * Which related algs a note also applies to: none (just this alg), lr (+ its left-right
 * mirror), fb (+ its front-back mirror), both (the alg in all four slots: both mirrors and
 * the alg turned 180°), linked (everywhere its idea is: mirrors, the same execution after a
 * rotation, and their mirrors in turn). See CatalogAlg.familyId and executionId.
 */
export const NOTE_SYMMETRIES = ["none", "lr", "fb", "both", "linked"] as const;
export type NoteSymmetry = (typeof NOTE_SYMMETRIES)[number];

/** Longest note the server accepts, in characters. */
export const MAX_NOTE_LENGTH = 5000;

/** A note for yourself, written on an alg. An alg can have several. */
export interface Note {
  /** uuid, chosen by the client when the note is written */
  id: string;
  /** The alg it was written on; `symmetry` says which of its mirrors also show it. */
  alg: AlgRef;
  slotCaseId: string;
  symmetry: NoteSymmetry;
  text: string;
  /** ISO timestamps */
  createdAt: string;
  updatedAt: string;
}

/** A custom alg the user added for a slot-case (stage 2: no endpoints yet). */
export interface UserAlg {
  id: string;
  slotCaseId: string;
  moves: string;
  createdAt: string;
}

// GET /api/f2l/progress
export interface ProgressResponse {
  progress: SlotCaseProgress[];
  algs: AlgState[];
  notes: Note[];
}

// PUT /api/f2l/progress/:slotCaseId -> SlotCaseProgress, or null when mainAlg is null
// (clearing the main alg removes the slot-case's row).
export interface PutProgressBody {
  mainAlg: AlgRef | null;
}

// PATCH /api/f2l/algs/:kind/:id -> AlgState, or null when status is null.
export interface PatchAlgBody {
  status: AlgStatus | null;
}

// PUT /api/f2l/notes/:id -> Note (created or updated), or null when text is empty (deletes it).
// A note keeps the alg it was written on.
export interface PutNoteBody {
  alg: AlgRef;
  symmetry: NoteSymmetry;
  text: string;
}
