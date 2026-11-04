// Downloads cubicdb's alg database into raw/cubicdb/.
//
// cubicdb (https://github.com/isaacvr/cubicdb) ships its alg DB as a NeDB file:
// one JSON object per line. It covers all 41 F2L cases for the FR slot only,
// with a setup ("scramble") and a handful of algs each. Used as a cross-check.
import { fetchCached, forceFlag } from "./http.ts";

export const ALGS_DB_PATH = "raw/cubicdb/algs.db";
const URL = "https://raw.githubusercontent.com/isaacvr/cubicdb/HEAD/src/database/algs.db";

if (import.meta.main) {
  console.log("Fetching cubicdb algs.db...");
  await fetchCached(URL, ALGS_DB_PATH, { force: forceFlag });
  console.log("Done.");
}
