// Polite, cached HTTP fetching. Every response is stored on disk under raw/,
// so re-running a fetch script only hits the network for missing files.
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const USER_AGENT =
  "cubetrainer-catalog-builder/0.1 (personal, non-commercial F2L trainer; one-off data collection)";
const DELAY_MS = 2000;

let lastRequestAt = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchCached(
  url: string,
  path: string,
  { force = false } = {},
): Promise<string> {
  if (!force && existsSync(path)) return readFile(path, "utf8");

  const wait = lastRequestAt + DELAY_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();

  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      const body = await res.text();
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, body);
      return body;
    } catch (err) {
      if (attempt >= 3) throw err;
      console.warn(`  retry ${attempt} for ${url}: ${(err as Error).message}`);
      await sleep(DELAY_MS * attempt * 2);
    }
  }
}

export const forceFlag = process.argv.includes("--force");
