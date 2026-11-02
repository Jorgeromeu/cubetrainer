// Repository for imported solves, and the export parsers. The only module that touches
// the stats tables.
import type { DatabaseSync } from "node:sqlite";
import {
  IMPORT_FORMATS,
  type ImportBody,
  type ImportFormat,
  type ImportResponse,
  MAX_REASON_LENGTH,
  type PatchSolveBody,
  type Penalty,
  type ScrambledBy,
  type Solve,
} from "../../../../shared/stats/solves.ts";
import { InvalidRequest } from "../../http.ts";

interface SolveRow {
  id: string;
  ms: number;
  penalty: Penalty;
  penalty_known: 0 | 1;
  scramble: string;
  scrambled_by: ScrambledBy;
  comment: string;
  solved_at: string;
  source: string;
  excluded: 0 | 1;
  excluded_reason: string;
}

const toSolve = (row: SolveRow): Solve => ({
  id: row.id,
  ms: row.ms,
  penalty: row.penalty,
  penaltyKnown: row.penalty_known === 1,
  scramble: row.scramble,
  scrambledBy: row.scrambled_by,
  comment: row.comment,
  solvedAt: row.solved_at,
  source: row.source,
  excluded: row.excluded === 1,
  excludedReason: row.excluded_reason,
});

/** A solve as read from an export, before it has an id. */
type ParsedSolve = Omit<Solve, "id" | "source" | "penaltyKnown" | "scrambledBy" | "excluded" | "excludedReason">;

/** Biggest export accepted, in characters (a CubeTime session is ~100 bytes a solve). */
const MAX_IMPORT_LENGTH = 20_000_000;

export function solvesRepository(db: DatabaseSync) {
  const selectAll = db.prepare("SELECT * FROM solves ORDER BY solved_at");
  const selectOne = db.prepare("SELECT * FROM solves WHERE id = ?");
  const updateExcluded = db.prepare("UPDATE solves SET excluded = ?, excluded_reason = ? WHERE id = ?");
  const insert = db.prepare(`
    INSERT INTO solves (id, ms, penalty, penalty_known, scramble, scrambled_by, comment, solved_at, source, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (source, solved_at, ms) DO NOTHING`);

  return {
    list: (): Solve[] => (selectAll.all() as unknown as SolveRow[]).map(toSolve),

    /** Excludes a solve from the stats, or includes it again. */
    patch(id: string, body: unknown): Solve {
      const { excluded, reason = "" } = parsePatchBody(body);
      if (!updateExcluded.run(excluded ? 1 : 0, excluded ? reason : "", id).changes) throw new InvalidRequest(`Unknown solve ${id}`);
      return toSolve(selectOne.get(id) as unknown as SolveRow);
    },

    /** Adds an export's solves, skipping the ones already imported. All or nothing. */
    import(body: unknown): ImportResponse {
      const { format, text, handScrambled, penaltiesUnreliable } = parseImportBody(body);
      const scrambledBy: ScrambledBy = handScrambled ? "hand" : "timer";
      const penaltyKnown = penaltiesUnreliable ? 0 : 1;
      const parsed = PARSERS[format](text);
      const now = new Date().toISOString();
      let added = 0;
      db.exec("BEGIN");
      try {
        for (const s of parsed)
          added += Number(
            insert.run(crypto.randomUUID(), s.ms, s.penalty, penaltyKnown, s.scramble, scrambledBy, s.comment, s.solvedAt, format, now)
              .changes,
          );
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
      return { added, skipped: parsed.length - added };
    },
  };
}

function parsePatchBody(body: unknown): PatchSolveBody {
  const { excluded, reason = "", ...rest } = (body ?? {}) as Record<string, unknown>;
  const unknownKeys = Object.keys(rest);
  if (unknownKeys.length) throw new InvalidRequest(`Unknown field(s): ${unknownKeys.join(", ")}`);
  if (typeof excluded !== "boolean") throw new InvalidRequest("excluded must be true or false");
  if (typeof reason !== "string" || reason.length > MAX_REASON_LENGTH)
    throw new InvalidRequest(`reason must be a string of at most ${MAX_REASON_LENGTH} characters`);
  return { excluded, reason: reason.trim() };
}

function parseImportBody(body: unknown): ImportBody {
  const { format, text, handScrambled = false, penaltiesUnreliable = false, ...rest } = (body ?? {}) as Record<string, unknown>;
  const unknownKeys = Object.keys(rest);
  if (unknownKeys.length) throw new InvalidRequest(`Unknown field(s): ${unknownKeys.join(", ")}`);
  if (!IMPORT_FORMATS.includes(format as ImportFormat))
    throw new InvalidRequest(`format must be one of ${IMPORT_FORMATS.join(", ")}`);
  if (typeof text !== "string" || text.length > MAX_IMPORT_LENGTH) throw new InvalidRequest("text must be the export file's contents");
  if (typeof handScrambled !== "boolean") throw new InvalidRequest("handScrambled must be true or false");
  if (typeof penaltiesUnreliable !== "boolean") throw new InvalidRequest("penaltiesUnreliable must be true or false");
  return { format: format as ImportFormat, text, handScrambled, penaltiesUnreliable };
}

const PARSERS: Record<ImportFormat, (text: string) => ParsedSolve[]> = {
  cubetime: parseCubeTime,
};

/**
 * A CubeTime session export (Sessions → Export → CSV): a header row
 * `Time,Comment,Scramble,Date`, then one row per solve, in no particular order. Time is
 * in seconds; Date like "2026-09-19 12:09:02 PM +0000". A Penalty column, or a time
 * written "DNF" / "12.34+", is read as the penalty if present.
 */
export function parseCubeTime(text: string): ParsedSolve[] {
  const [header, ...rows] = parseCsv(text).filter((r) => r.some((cell) => cell.trim()));
  if (!header) throw new InvalidRequest("The file is empty");
  const column = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());
  const [time, comment, scramble, date, penalty] = ["Time", "Comment", "Scramble", "Date", "Penalty"].map(column);
  if (time < 0 || date < 0) throw new InvalidRequest("Not a CubeTime export: it needs Time and Date columns");

  return rows.map((row, i) => {
    const line = i + 2;
    const rawTime = row[time]?.trim() ?? "";
    const rawPenalty = penalty >= 0 ? (row[penalty]?.trim().toLowerCase() ?? "") : "";
    const dnf = /dnf/i.test(rawTime) || rawPenalty === "dnf";
    const plusTwo = rawTime.endsWith("+") || rawPenalty === "+2" || rawPenalty === "plustwo";
    const seconds = Number(rawTime.replace(/[^\d.]/g, ""));
    if (!(seconds > 0) && !dnf) throw new InvalidRequest(`Line ${line}: "${rawTime}" isn't a time`);
    return {
      ms: Math.max(1, Math.round(seconds * 1000)),
      penalty: dnf ? "dnf" : plusTwo ? "+2" : "ok",
      scramble: scramble >= 0 ? (row[scramble]?.trim() ?? "") : "",
      comment: comment >= 0 ? (row[comment]?.trim() ?? "") : "",
      solvedAt: parseCubeTimeDate(row[date] ?? "", line),
    };
  });
}

/** "2026-09-19 12:09:02 PM +0000" (or 24-hour, without AM/PM) -> ISO, in UTC. */
function parseCubeTimeDate(raw: string, line: number): string {
  const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2}):(\d{2})(?:\s*([AP]M))?\s*(?:([+-])(\d{2}):?(\d{2}))?$/i);
  if (!m) throw new InvalidRequest(`Line ${line}: "${raw}" isn't a date`);
  const [, y, mo, d, h, mi, s, ampm, sign, oh = "0", om = "0"] = m;
  let hour = Number(h) % (ampm ? 12 : 24);
  if (ampm?.toUpperCase() === "PM") hour += 12;
  const offsetMin = (sign === "-" ? -1 : 1) * (Number(oh) * 60 + Number(om));
  const utc = Date.UTC(Number(y), Number(mo) - 1, Number(d), hour, Number(mi), Number(s)) - offsetMin * 60_000;
  return new Date(utc).toISOString();
}

/** RFC 4180 CSV: quoted cells may hold commas, newlines and "" for a quote. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") row.push(cell), (cell = "");
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell), rows.push(row), (row = []), (cell = "");
    } else cell += c;
  }
  if (cell || row.length) row.push(cell), rows.push(row);
  return rows;
}
