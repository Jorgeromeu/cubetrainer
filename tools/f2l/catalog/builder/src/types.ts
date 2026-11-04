// Shape of the per-source datasets written to data/. This is the *collected*
// data, kept close to the source. It isn't the app catalog schema (§5.1);
// building that from these files is a later step.

export const SLOTS = ["FR", "FL", "BR", "BL"] as const;
export type Slot = (typeof SLOTS)[number];

export interface SourceAlg {
  /** Move sequence, whitespace-normalised but otherwise as published. */
  moves: string;
  /** Position in the source's list for this slot-case (0 = first shown). */
  rank: number;
  /** The source's own id for the alg, if it has one. */
  sourceId?: string;
  votes?: number;
  etm?: number;
  stm?: number;
  /** e.g. "2GEN (R U)" */
  faceMoves?: string;
  videoUrl?: string;
}

export interface SourceCase {
  /** 1..41, SpeedCubeDB / Algdb numbering. */
  number: number;
  name: string;
  group?: string;
  /** Setups as published. Sources usually only give one for FR. */
  setups: Partial<Record<Slot, string>>;
  algs: Partial<Record<Slot, SourceAlg[]>>;
}

export interface SourceDataset {
  source: string;
  sourceUrl: string;
  collectedAt: string;
  notes: string[];
  cases: SourceCase[];
}

/** Collapses whitespace and fixes typographic primes (’ ′ ‘) some sources use. */
export const normaliseMoves = (moves: string) =>
  moves.replace(/[’‘′`]/g, "'").replace(/\s+/g, " ").trim();
