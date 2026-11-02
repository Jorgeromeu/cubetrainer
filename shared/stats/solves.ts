// The stats trainer's API contract between server/ and app/: full solves from any timer,
// imported from its export file, to chart.

import type { Penalty, TimedSolve } from "../../packages/core/solve.ts";

/** The timers whose exports can be imported. */
export const IMPORT_FORMATS = ["cubetime"] as const;
export type ImportFormat = (typeof IMPORT_FORMATS)[number];

/** How a solve was scrambled: with the timer's scramble, or by hand (then `scramble` wasn't used). */
export const SCRAMBLED_BY = ["timer", "hand"] as const;
export type ScrambledBy = (typeof SCRAMBLED_BY)[number];

/** One timed solve. */
export interface Solve extends TimedSolve {
  /** uuid, made by the server on import */
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
  /** Where it came from: an ImportFormat, or another timer's name for solves added by hand. */
  source: string;
  /** Left out of every stat (a misfire, an anomaly), but kept so a re-import skips it. */
  excluded: boolean;
  /** Why, "" if not said. */
  excludedReason: string;
}

/** Longest exclusion reason accepted. */
export const MAX_REASON_LENGTH = 200;

// PATCH /api/stats/solves/:id -> Solve
export interface PatchSolveBody {
  excluded: boolean;
  /** Kept only while excluded; "" if left out. */
  reason?: string;
}

// GET /api/stats/solves
export interface SolvesResponse {
  /** Oldest first. */
  solves: Solve[];
}

// POST /api/stats/import -> ImportResponse. Solves already in the DB (same source, time
// and moment) are skipped, so importing a newer export of the same session only adds the
// new ones.
export interface ImportBody {
  format: ImportFormat;
  /** The export file's contents. */
  text: string;
  /** Scrambled by hand, not with the timer's scrambles. Default false. */
  handScrambled?: boolean;
  /** +2s and DNFs weren't reliably marked. Default false. */
  penaltiesUnreliable?: boolean;
}

export interface ImportResponse {
  added: number;
  /** Already imported. */
  skipped: number;
}

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

// GET /api/stats/milestones
export interface MilestonesResponse {
  /** By start day. */
  milestones: Milestone[];
}

// PUT /api/stats/milestones/:id -> Milestone (creates or replaces)
export interface PutMilestoneBody {
  label: string;
  startDay: string;
  endDay?: string | null;
}

// DELETE /api/stats/milestones/:id -> null
