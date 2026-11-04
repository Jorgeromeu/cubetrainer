// Repository for solves (timed here or imported) and imports, and the export parsers. The
// only module that touches the solves and imports tables.
import type { DatabaseSync } from "node:sqlite";
import {
  IMPORT_FORMATS,
  type Import,
  type ImportBody,
  type ImportFormat,
  type ImportResponse,
  MAX_REASON_LENGTH,
  type PatchSolveBody,
  type PutSolveBody,
  type ScrambledBy,
  type Solve,
  TIMER_SOURCE,
} from "../contract.ts";
import { PENALTIES, type Penalty } from "../../../packages/core/solve.ts";
import { bodyOf, InvalidRequest, transaction } from "../../../server/src/tool.ts";

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
  import_id: string | null;
  excluded: 0 | 1;
  excluded_reason: string;
}

interface ImportRow {
  id: string;
  source: string;
  file_name: string;
  imported_at: string;
  added: number;
  skipped: number;
}

const toImport = (row: ImportRow): Import => ({
  id: row.id,
  source: row.source,
  fileName: row.file_name,
  importedAt: row.imported_at,
  added: row.added,
  skipped: row.skipped,
});

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
  importId: row.import_id,
  excluded: row.excluded === 1,
  excludedReason: row.excluded_reason,
});

/** A solve as read from an export, before it has an id. */
type ParsedSolve = Omit<Solve, "id" | "source" | "importId" | "penaltyKnown" | "scrambledBy" | "excluded" | "excludedReason">;

/** Longest scramble accepted for a solve timed here. */
const MAX_SCRAMBLE_LENGTH = 500;
/** Longest solve accepted: an hour. */
const MAX_SOLVE_MS = 3_600_000;

/** Biggest export accepted, in characters (a CubeTime session is ~100 bytes a solve). */
const MAX_IMPORT_LENGTH = 20_000_000;

export function solvesRepository(db: DatabaseSync) {
  const selectAll = db.prepare("SELECT * FROM solves ORDER BY solved_at");
  const selectOne = db.prepare("SELECT * FROM solves WHERE id = ?");
  const updateExcluded = db.prepare("UPDATE solves SET excluded = ?, excluded_reason = ? WHERE id = ?");
  const updatePenalty = db.prepare("UPDATE solves SET penalty = ?, penalty_known = 1 WHERE id = ?");
  const insert = db.prepare(`
    INSERT INTO solves (id, ms, penalty, penalty_known, scramble, scrambled_by, comment, solved_at, source, import_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT DO NOTHING`);
  const deleteTimed = db.prepare("DELETE FROM solves WHERE id = ? AND source = ?");
  const selectImports = db.prepare("SELECT * FROM imports ORDER BY imported_at");
  const insertImport = db.prepare("INSERT INTO imports (id, source, file_name, imported_at, added, skipped) VALUES (?, ?, ?, ?, ?, ?)");
  const deleteImportSolves = db.prepare("DELETE FROM solves WHERE import_id = ?");
  const deleteImportRow = db.prepare("DELETE FROM imports WHERE id = ?");
  const updateImportCounts = db.prepare("UPDATE imports SET added = ?, skipped = ? WHERE id = ?");

  const get = (id: string) => {
    const row = selectOne.get(id) as unknown as SolveRow | undefined;
    return row && toSolve(row);
  };

  return {
    list: (): Solve[] => (selectAll.all() as unknown as SolveRow[]).map(toSolve),

    /** Saves a solve timed here. Saving the same id again returns it unchanged. */
    put(id: string, body: unknown): Solve {
      checkId(id);
      const existing = get(id);
      if (existing) return existing;
      const { ms, penalty, scramble, solvedAt } = parsePutBody(body);
      insert.run(id, ms, penalty, 1, scramble, "timer", "", solvedAt, TIMER_SOURCE, null, new Date().toISOString());
      const saved = get(id);
      // Same source, moment and time as another solve: there's no such second solve.
      if (!saved) throw new InvalidRequest("A solve with the same time and moment is already saved");
      return saved;
    },

    /** Excludes a solve from the stats or includes it again, and/or sets its penalty. */
    patch(id: string, body: unknown): Solve {
      const { excluded, reason = "", penalty } = parsePatchBody(body);
      if (!get(id)) throw new InvalidRequest(`Unknown solve ${id}`);
      transaction(db, () => {
        if (excluded !== undefined) updateExcluded.run(excluded ? 1 : 0, excluded ? reason : "", id);
        if (penalty !== undefined) updatePenalty.run(penalty, id);
      });
      return get(id)!;
    },

    /** Deletes a solve timed here (imported ones are excluded instead). */
    remove(id: string): null {
      const solve = get(id);
      if (!solve) return null;
      if (solve.source !== TIMER_SOURCE) throw new InvalidRequest("Imported solves can't be deleted: exclude them, or undo their import");
      deleteTimed.run(id, TIMER_SOURCE);
      return null;
    },

    /** Adds an export's solves, skipping the ones already imported. All or nothing. */
    import(body: unknown): ImportResponse {
      const { format, text, fileName = "", handScrambled, penaltiesUnreliable } = parseImportBody(body);
      const scrambledBy: ScrambledBy = handScrambled ? "hand" : "timer";
      const penaltyKnown = penaltiesUnreliable ? 0 : 1;
      const parsed = PARSERS[format](text);
      const now = new Date().toISOString();
      const importId = crypto.randomUUID();
      return transaction(db, () => {
        // The import row first: the solves point to it. Dropped again if it adds nothing.
        insertImport.run(importId, format, fileName, now, 0, 0);
        let added = 0;
        for (const s of parsed)
          added += Number(
            insert.run(crypto.randomUUID(), s.ms, s.penalty, penaltyKnown, s.scramble, scrambledBy, s.comment, s.solvedAt, format, importId, now)
              .changes,
          );
        const skipped = parsed.length - added;
        if (!added) {
          deleteImportRow.run(importId);
          return { import: null, added, skipped };
        }
        updateImportCounts.run(added, skipped, importId);
        return { import: { id: importId, source: format, fileName, importedAt: now, added, skipped }, added, skipped };
      });
    },

    imports: (): Import[] => (selectImports.all() as unknown as ImportRow[]).map(toImport),

    /** Undoes an import: its solves and its record go. */
    removeImport(id: string): null {
      transaction(db, () => {
        deleteImportSolves.run(id);
        deleteImportRow.run(id);
      });
      return null;
    },
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function checkId(id: string) {
  if (!UUID.test(id)) throw new InvalidRequest("id must be a uuid");
}

function parsePutBody(body: unknown): PutSolveBody {
  const { ms, penalty, scramble, solvedAt } = bodyOf(body, ["ms", "penalty", "scramble", "solvedAt"]);
  if (typeof ms !== "number" || !Number.isInteger(ms) || ms <= 0 || ms > MAX_SOLVE_MS)
    throw new InvalidRequest(`ms must be a whole number of milliseconds, at most ${MAX_SOLVE_MS}`);
  if (!PENALTIES.includes(penalty as Penalty)) throw new InvalidRequest(`penalty must be one of ${PENALTIES.join(", ")}`);
  if (typeof scramble !== "string" || scramble.length > MAX_SCRAMBLE_LENGTH)
    throw new InvalidRequest(`scramble must be a string of at most ${MAX_SCRAMBLE_LENGTH} characters`);
  if (typeof solvedAt !== "string" || Number.isNaN(Date.parse(solvedAt))) throw new InvalidRequest("solvedAt must be an ISO timestamp");
  return { ms, penalty: penalty as Penalty, scramble: scramble.trim(), solvedAt: new Date(solvedAt).toISOString() };
}

function parsePatchBody(body: unknown): PatchSolveBody {
  const { excluded, reason = "", penalty } = bodyOf(body, ["excluded", "reason", "penalty"]);
  if (excluded === undefined && penalty === undefined) throw new InvalidRequest("Nothing to change: give excluded or penalty");
  if (excluded !== undefined && typeof excluded !== "boolean") throw new InvalidRequest("excluded must be true or false");
  if (typeof reason !== "string" || reason.length > MAX_REASON_LENGTH)
    throw new InvalidRequest(`reason must be a string of at most ${MAX_REASON_LENGTH} characters`);
  if (penalty !== undefined && !PENALTIES.includes(penalty as Penalty)) throw new InvalidRequest(`penalty must be one of ${PENALTIES.join(", ")}`);
  return { excluded: excluded as boolean | undefined, reason: reason.trim(), penalty: penalty as Penalty | undefined };
}

function parseImportBody(body: unknown): ImportBody {
  const { format, text, fileName = "", handScrambled = false, penaltiesUnreliable = false } = bodyOf(body, ["format", "text", "fileName", "handScrambled", "penaltiesUnreliable"]);
  if (!IMPORT_FORMATS.includes(format as ImportFormat))
    throw new InvalidRequest(`format must be one of ${IMPORT_FORMATS.join(", ")}`);
  if (typeof text !== "string" || text.length > MAX_IMPORT_LENGTH) throw new InvalidRequest("text must be the export file's contents");
  if (typeof handScrambled !== "boolean") throw new InvalidRequest("handScrambled must be true or false");
  if (typeof penaltiesUnreliable !== "boolean") throw new InvalidRequest("penaltiesUnreliable must be true or false");
  if (typeof fileName !== "string" || fileName.length > 200) throw new InvalidRequest("fileName must be a string of at most 200 characters");
  return { format: format as ImportFormat, text, fileName: fileName.trim(), handScrambled, penaltiesUnreliable };
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
function parseCubeTime(text: string): ParsedSolve[] {
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
