// Parses the cached SpeedCubeDB pages into data/speedcubedb-f2l.json.
import { statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import { LISTING_PATH, morePath } from "./fetch-speedcubedb.ts";
import { normaliseMoves, type Slot, type SourceAlg, type SourceCase, type SourceDataset } from "./types.ts";

const OUT_PATH = "data/speedcubedb-f2l.json";

const SLOT_BY_LABEL: Record<string, Slot> = {
  "Front Right": "FR",
  "Front Left": "FL",
  "Back Right": "BR",
  "Back Left": "BL",
};

function parseAlgItems($: cheerio.CheerioAPI, items: cheerio.Cheerio<AnyNode>): Omit<SourceAlg, "rank">[] {
  return items
    .toArray()
    .filter((li) => $(li).find(".formatted-alg").length > 0)
    .map((li) => {
      const $li = $(li);
      const statText = (title: string) =>
        $li.find(".stats-title").filter((_, el) => $(el).text().trim() === title).parent();
      const votesText = statText("Community Votes:").text().replace("Community Votes:", "").trim();
      const badges = statText("Movecount:").find(".badge").toArray().map((b) => $(b).text().trim());
      const num = (suffix: string) => {
        const b = badges.find((t) => t.endsWith(suffix));
        return b ? Number.parseInt(b) : undefined;
      };
      const faceMoves = statText("Face Moves:").text().replace("Face Moves:", "").replace(/\s+/g, " ").trim();
      return {
        moves: normaliseMoves($li.find(".formatted-alg").first().text()),
        sourceId: $li.find("[data-altid]").first().attr("data-altid"),
        votes: votesText ? Number.parseInt(votesText) : undefined,
        etm: num("ETM"),
        stm: num("STM"),
        faceMoves: faceMoves || undefined,
        videoUrl: $li.find('a[href*="youtube.com"]').attr("href"),
      };
    });
}

async function main() {
  const $ = cheerio.load(await readFile(LISTING_PATH, "utf8"));
  const cases: SourceCase[] = [];

  for (const el of $(".singlealgorithm").toArray()) {
    const $case = $(el);
    const name = $case.attr("data-alg")!;
    const number = Number.parseInt(name.replace(/^F2L\s*/, ""));
    const setup = $case.find(".setup-case").clone().children("div").remove().end().text();

    // Map tab index (data-ori) -> slot using the tab labels, not a hardcoded order.
    const slotByOri = new Map<string, Slot>();
    $case.find(".tabs-orientation a[data-ori]").each((_, a) => {
      const label = $(a).text().trim();
      const slot = SLOT_BY_LABEL[label];
      if (!slot) throw new Error(`${name}: unknown slot tab "${label}"`);
      slotByOri.set($(a).attr("data-ori")!, slot);
    });

    const algs: SourceCase["algs"] = {};
    for (const [ori, slot] of slotByOri) {
      const top = parseAlgItems($, $case.find(`div[data-ori='${ori}'] > ul > li`));
      let more: Omit<SourceAlg, "rank">[] = [];
      if ($case.find(`.more-algs[data-d='${ori}']`).length) {
        const $more = cheerio.load(await readFile(morePath(name, ori), "utf8"));
        more = parseAlgItems($more, $more("li"));
      }
      // The fragment may repeat algs already on the page; keep first occurrence.
      const seen = new Set<string>();
      algs[slot] = [...top, ...more]
        .filter((a) => {
          const key = a.sourceId ?? a.moves;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map((a, rank) => ({ ...a, rank }));
    }

    cases.push({
      number,
      name,
      group: $case.attr("data-subgroup") || undefined,
      setups: { FR: normaliseMoves(setup) },
      algs,
    });
  }

  cases.sort((a, b) => a.number - b.number);
  const dataset: SourceDataset = {
    source: "speedcubedb",
    sourceUrl: "https://speedcubedb.com/a/3x3/F2L",
    collectedAt: statSync(LISTING_PATH).mtime.toISOString(),
    notes: [
      "Algs are per slot, as listed on the slot tabs, in SpeedCubeDB's display order (rank 0 = top).",
      "Only the FR setup is published; setups for other slots must be derived.",
      "Algs are written for cross on D (the site displays them with a z2 setup on a white-top cube).",
      "votes can be negative; low/negative-vote algs are often junk (very long, odd regrips).",
    ],
    cases,
  };

  await mkdir("data", { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(dataset, null, 2) + "\n");

  const total = cases.reduce((n, c) => n + Object.values(c.algs).reduce((m, a) => m + a.length, 0), 0);
  console.log(`Wrote ${OUT_PATH}: ${cases.length} cases, ${total} algs.`);
}

if (import.meta.main) await main();
