// The PLL catalog contract (catalog/pll.json): written by catalog-builder/src/build-pll.ts,
// read by the app's PLL trainer.

export interface PllCatalog {
  version: 1;
  generatedAt: string;
  caseSet: { id: "pll"; name: string };
  /** Ordered by group, then name. */
  cases: PllCase[];
}

export interface PllArrow {
  /** [col, row] on the top face, back row first. */
  from: [number, number];
  to: [number, number];
  /** A swap: one arrow with a head at each end. */
  both?: boolean;
}

export interface PllCase {
  /** e.g. "pll-Ua" */
  id: string;
  name: string;
  group: string;
  /** Algs from SpeedCubeDB, best first, as written there. */
  algs: string[];
  /** Face turns only, from solved; each gives this case, possibly needing an AUF. */
  scrambles: string[];
  /** 5x5 grid of face letters, rows joined by "/": the U face plus each side's top row. */
  stickers: string;
  arrows: PllArrow[];
}
