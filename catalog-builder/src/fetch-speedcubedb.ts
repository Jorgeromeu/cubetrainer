// Downloads SpeedCubeDB's F2L data into raw/speedcubedb/.
//
// SpeedCubeDB has no public API, but its pages are server-rendered:
// - https://speedcubedb.com/a/3x3/F2L lists all 41 cases with group, FR setup
//   and the top 4 algs for each of the 4 slots (tabs, `data-ori` 0..3).
// - Each slot tab has a "More Algorithms" button that GETs
//   category.algs.php?algname=F2L%20N&d=<ori>&cat=F2L, an HTML fragment with
//   the rest of the algs for that (case, slot).
// So the full dataset is 1 + 41*4 = 165 requests.
import * as cheerio from "cheerio";
import { fetchCached, forceFlag } from "./http.ts";

const BASE = "https://speedcubedb.com";
export const RAW_DIR = "raw/speedcubedb";
export const LISTING_PATH = `${RAW_DIR}/F2L.html`;
export const morePath = (algName: string, ori: string) =>
  `${RAW_DIR}/more/${algName.replace(/\s+/g, "_")}_${ori}.html`;

async function main() {
  console.log("Fetching F2L listing page...");
  const listing = await fetchCached(`${BASE}/a/3x3/F2L`, LISTING_PATH, { force: forceFlag });
  const $ = cheerio.load(listing);

  const buttons = $(".singlealgorithm .more-algs")
    .toArray()
    .map((el) => ({
      algName: $(el).attr("data-algname")!,
      ori: $(el).attr("data-d")!,
      cat: $(el).attr("data-category")!,
    }));
  console.log(`Found ${buttons.length} "more algs" lists.`);

  let i = 0;
  for (const { algName, ori, cat } of buttons) {
    i++;
    const url = `${BASE}/category.algs.php?algname=${encodeURIComponent(algName)}&d=${ori}&cat=${encodeURIComponent(cat)}`;
    process.stdout.write(`\r  [${i}/${buttons.length}] ${algName} ori=${ori}   `);
    await fetchCached(url, morePath(algName, ori), { force: forceFlag });
  }
  console.log("\nDone.");
}

if (import.meta.main) await main();
