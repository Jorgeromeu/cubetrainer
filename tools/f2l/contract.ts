// The user-data API contract between server/ and app/. See docs/requirements.md §5.2.
import type { LinkKind } from "../../packages/core/catalog/f2l.ts";

/**
 * Which alg a slot-case's main alg is. Catalog algs live in catalog/f2l.json; user algs
 * (algs you add yourself, see UserAlg) live in the user_algs table.
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
export const ALG_STATUSES = ["wanted", "learning", "learnt"] as const;
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
 * The link kinds a note spreads along: it shows on the alg it was written on and on every
 * alg reachable from it through links of these kinds (any number of steps). Empty: only
 * the alg itself. See LinkKind.
 */
export type NoteFollows = LinkKind[];

/** Longest note the server accepts, in characters. */
export const MAX_NOTE_LENGTH = 5000;

/** A note for yourself, written on an alg. An alg can have several. */
export interface Note {
  /** uuid, chosen by the client when the note is written */
  id: string;
  /** The alg it was written on; `follows` says which linked algs also show it. */
  alg: AlgRef;
  slotCaseId: string;
  follows: NoteFollows;
  text: string;
  /** ISO timestamps */
  createdAt: string;
  updatedAt: string;
}

/** Longest video link the server accepts, in characters. */
export const MAX_VIDEO_URL_LENGTH = 2000;

/** A video for an alg (a tutorial, an example solve): one http(s) link per alg. */
export interface VideoLink {
  alg: AlgRef;
  slotCaseId: string;
  url: string;
  /** ISO timestamp */
  updatedAt: string;
}

/** Longest user alg the server accepts, in characters. */
export const MAX_USER_ALG_LENGTH = 200;

/**
 * An alg you added yourself for a slot-case. The app checks on the cube that it solves the
 * case before saving it; the server only checks the notation (it has no cube model).
 * Moves are space-separated, written as for a catalog alg: from the case's own angle.
 * Empty moves make a placeholder: an alg you mean to add, kept for now as just its notes
 * (its moves are filled in later, see PatchUserAlgBody). It can still be your main alg.
 */
export interface UserAlg {
  /** uuid, chosen by the client */
  id: string;
  slotCaseId: string;
  moves: string;
  /** ISO timestamp */
  createdAt: string;
}

// GET /api/f2l/progress
export interface ProgressResponse {
  progress: SlotCaseProgress[];
  algs: AlgState[];
  notes: Note[];
  videos: VideoLink[];
  userAlgs: UserAlg[];
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
  follows: NoteFollows;
  text: string;
}

// PUT /api/f2l/videos/:kind/:id -> VideoLink, or null when url is null (removes it).
export interface PutVideoBody {
  url: string | null;
}

// PUT /api/f2l/user-algs/:id -> UserAlg. Creates it (empty moves: a placeholder); saving
// the same alg again returns it as it was (so retries are safe). A user alg can't be
// changed, only deleted, except for filling in a placeholder's moves (PATCH).
export interface PutUserAlgBody {
  slotCaseId: string;
  moves: string;
}

// PATCH /api/f2l/user-algs/:id -> UserAlg. Fills in a placeholder's moves (only a
// placeholder's: a user alg with moves still can't be changed). Its notes etc. stay.
export interface PatchUserAlgBody {
  moves: string;
}

// DELETE /api/f2l/user-algs/:id -> null. Also clears what hangs off it: main alg (where it
// is main), status, notes and video link.
