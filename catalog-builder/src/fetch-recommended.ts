// Downloads the published "recommended F2L algs" sheets into raw/recommended/:
// - J Perm's "Best F2L Algorithms" (linked from jperm.net as bit.ly/bestf2l, a PDF on
//   Google Drive): FR algs for the 41 basic cases (and their mirrors), plus advanced cases.
// - CubeSkills' "F2L Algorithms – All Four Slot Angles" by Feliks Zemdegs and Andy Klise:
//   algs for the 41 basic cases in each slot (FR, BR, FL, BL, two pages each).
// Both are public PDFs; parse-recommended.ts reads their text.
import { fetchCachedBinary, forceFlag } from "./http.ts";

export const RAW_DIR = "raw/recommended";

export const RECOMMENDED_SOURCES = [
  {
    id: "jperm",
    url: "https://drive.usercontent.google.com/download?id=1nzAXYUWZJ6H2wIOXaHdWXep3W57tArbR&export=download",
    path: `${RAW_DIR}/jperm-best-f2l.pdf`,
  },
  {
    id: "cubeskills",
    url: "https://www.cubeskills.com/uploads/pdf/tutorials/f2l-algorithms-different-slot-positions.pdf",
    path: `${RAW_DIR}/cubeskills-f2l-all-slots.pdf`,
  },
] as const;

async function main() {
  for (const { id, url, path } of RECOMMENDED_SOURCES) {
    console.log(`Fetching ${id}...`);
    await fetchCachedBinary(url, path, { force: forceFlag });
  }
  console.log("Done.");
}

if (import.meta.main) await main();
