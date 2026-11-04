// The "case-observations" capability (exposed.ts): a case you met and how it went. Any
// tool that sees cases provides it: a timer reconstructing smart cube solves (context
// "solve"), drills (context "drill"). A tool that owns your choices for a case set (your
// main alg, what you're learning) reads them all and compares; the providers never need
// to know those choices.
//
// Case ids are the catalogs' (catalog/*.json), the key every tool joins on.

/** The case sets with a catalog. */
export type CaseSet = 'f2l' | 'oll' | 'pll'

export interface CaseObservation {
  set: CaseSet
  /** The catalog's case id; for F2L the slot-case id (the case in a slot). */
  caseId: string
  /** ISO timestamp of when it was met. */
  at: string
  /** The pause before the first move, when the provider can tell (a smart cube can). */
  recognitionMs?: number
  /** From the first move to the case being solved. */
  executionMs: number
  /** What was done, space-separated, as the case is seen from its catalog angle. */
  moves: string
  /** The catalog alg the moves match, if any; undefined is your own way. */
  algId?: string
  context: 'solve' | 'drill'
}

// Args: { set? } to only get one set's.
export interface CaseObservations {
  /** Oldest first. */
  observations: CaseObservation[]
}
