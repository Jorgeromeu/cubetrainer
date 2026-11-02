// The PLL trainer's API contract between server/ and app/: timed solves, one per scramble.

import type { Penalty, TimedSolve } from "../../packages/core/solve.ts";

/** One timed solve of a PLL case: from the end of the countdown to the stop. */
export interface Solve extends TimedSolve {
  /** uuid, chosen by the client when the solve is timed */
  id: string;
  /** e.g. "pll-Ua" (catalog/pll.json) */
  caseId: string;
  /** Milliseconds as timed, without the penalty (including the lift from under the table). */
  ms: number;
  penalty: Penalty;
  /** The scramble it was timed on. */
  scramble: string;
  /** ISO timestamp */
  createdAt: string;
}

/** Longest solve the server accepts: anything longer was a forgotten timer. */
export const MAX_SOLVE_MS = 10 * 60 * 1000;

// GET /api/pll/solves
export interface SolvesResponse {
  /** Oldest first. */
  solves: Solve[];
}

// PUT /api/pll/solves/:id -> Solve. Saving the same id again is a no-op (a retried request).
export interface PutSolveBody {
  caseId: string;
  ms: number;
  scramble: string;
  /** "ok" if left out. */
  penalty?: Penalty;
}

// PATCH /api/pll/solves/:id -> Solve
export interface PatchSolveBody {
  penalty: Penalty;
}

// DELETE /api/pll/solves/:id -> null
