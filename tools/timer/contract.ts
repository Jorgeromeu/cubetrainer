// The timer tool's contract: its API between server/ and app/, and the calls it exposes
// to other tools (timerExposes, at the end). It owns every full solve, wherever it was
// timed: here (source "timer") or in another timer and imported from its export.

import { exposed } from "../../packages/core/exposed.ts";
import type { Penalty, TimedSolve } from "../../packages/core/solve.ts";

/** The source of solves timed with this tool; imported ones carry their timer's. */
export const TIMER_SOURCE = "timer";

/** The timers whose exports can be imported. */
export const IMPORT_FORMATS = ["cubetime"] as const;
export type ImportFormat = (typeof IMPORT_FORMATS)[number];

/** How a solve was scrambled: with the timer's scramble, or by hand (then `scramble` wasn't used). */
export const SCRAMBLED_BY = ["timer", "hand"] as const;
export type ScrambledBy = (typeof SCRAMBLED_BY)[number];

/** One timed solve. */
export interface Solve extends TimedSolve {
  /** uuid: made by the app for solves timed here, by the server on import */
  id: string;
  /** Milliseconds as timed, without the penalty. */
  ms: number;
  penalty: Penalty;
  /** False when penalties weren't reliably marked: `penalty` may be "ok" for a +2 or DNF. */
  penaltyKnown: boolean;
  /** The timer's scramble, kept even when it wasn't used (see scrambledBy). */
  scramble: string;
  scrambledBy: ScrambledBy;
  /** The timer's comment, "" if none. */
  comment: string;
  /** ISO timestamp of when it was solved (from the timer, not the import). */
  solvedAt: string;
  /**
   * Where it was timed: TIMER_SOURCE (here), an ImportFormat, or another timer's name for
   * solves added straight into the DB ("thecubeapp").
   */
  source: string;
  /** The import that added it (Import.id); null for solves timed here. */
  importId: string | null;
  /** Left out of every stat (a misfire, an anomaly), but kept so a re-import skips it. */
  excluded: boolean;
  /** Why, "" if not said. */
  excludedReason: string;
}

/** Longest exclusion reason accepted. */
export const MAX_REASON_LENGTH = 200;

// PUT /api/timer/solves/:id -> Solve. A solve timed here, id made by the app: saving it
// again returns it as it was, so retries are safe.
export interface PutSolveBody {
  ms: number;
  penalty: Penalty;
  scramble: string;
  solvedAt: string;
}

// PATCH /api/timer/solves/:id -> Solve. Each field optional; a penalty set by hand is known.
export interface PatchSolveBody {
  excluded?: boolean;
  /** Kept only while excluded; "" if left out. */
  reason?: string;
  penalty?: Penalty;
}

// DELETE /api/timer/solves/:id -> null. Only solves timed here: an imported one would come
// back with the next import of its file, so exclude it instead.

// GET /api/timer/solves
export interface SolvesResponse {
  /** Oldest first. */
  solves: Solve[];
}

// POST /api/timer/import -> ImportResponse. Solves already in the DB (same source, time
// and moment) are skipped, so importing a newer export of the same session only adds the
// new ones.
export interface ImportBody {
  format: ImportFormat;
  /** The export file's contents. */
  text: string;
  /** The export file's name, kept on the Import to tell imports apart. */
  fileName?: string;
  /** Scrambled by hand, not with the timer's scrambles. Default false. */
  handScrambled?: boolean;
  /** +2s and DNFs weren't reliably marked. Default false. */
  penaltiesUnreliable?: boolean;
}

export interface ImportResponse {
  /** The Import recorded, or null when it added nothing (then nothing is recorded). */
  import: Import | null;
  added: number;
  /** Already imported. */
  skipped: number;
}

/** One import of an export file: every solve it added points to it (Solve.importId). */
export interface Import {
  id: string;
  /** The solves' source: an ImportFormat, or another timer's name. */
  source: string;
  /** "" when not given (and for the imports from before they were recorded). */
  fileName: string;
  /** ISO timestamp */
  importedAt: string;
  added: number;
  skipped: number;
}

// GET /api/timer/imports -> ImportsResponse
export interface ImportsResponse {
  /** Oldest first. */
  imports: Import[];
}

// DELETE /api/timer/imports/:id -> null. Undoes an import: removes it and every solve it
// added (exclusions on them included). Importing the file again brings them back.

/** A day or range of days worth marking on the timeline ("learning PLL"). */
export interface Milestone {
  /** uuid, made by the client */
  id: string;
  label: string;
  /** Local calendar day, "2026-09-05". */
  startDay: string;
  /** The last day of a range, included; null for a single day. */
  endDay: string | null;
}

/** Longest milestone label accepted. */
export const MAX_MILESTONE_LABEL = 80;

// GET /api/timer/milestones
export interface MilestonesResponse {
  /** By start day. */
  milestones: Milestone[];
}

// PUT /api/timer/milestones/:id -> Milestone (creates or replaces)
export interface PutMilestoneBody {
  label: string;
  startDay: string;
  endDay?: string | null;
}

// DELETE /api/timer/milestones/:id -> null

// Exposed to other tools (packages/core/exposed.ts).

export const timerExposes = {
  /** Every solve, oldest first, excluded ones included (marked): it's for the reader to skip them. */
  solves: exposed<SolvesResponse>("timer", "solves"),
};
