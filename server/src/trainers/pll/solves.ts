// Repository for PLL solves. The only module that touches PLL's tables.
import type { DatabaseSync } from "node:sqlite";
import type { PllCatalog } from "../../../../packages/core/catalog/pll.ts";
import { PENALTIES, type Penalty } from "../../../../packages/core/solve.ts";
import { MAX_SOLVE_MS, type PatchSolveBody, type PutSolveBody, type Solve } from "../../../../shared/pll/solves.ts";
import { InvalidRequest } from "../../http.ts";

interface SolveRow {
  id: string;
  case_id: string;
  ms: number;
  penalty: Penalty;
  scramble: string;
  created_at: string;
}

const toSolve = (row: SolveRow): Solve => ({
  id: row.id,
  caseId: row.case_id,
  ms: row.ms,
  penalty: row.penalty,
  scramble: row.scramble,
  createdAt: row.created_at,
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function solvesRepository(db: DatabaseSync, catalog: PllCatalog) {
  const caseIds = new Set(catalog.cases.map((c) => c.id));

  const selectAll = db.prepare("SELECT * FROM solves ORDER BY created_at");
  const selectOne = db.prepare("SELECT * FROM solves WHERE id = ?");
  const insert = db.prepare(`
    INSERT INTO solves (id, case_id, ms, penalty, scramble, created_at) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (id) DO NOTHING`);
  const updatePenalty = db.prepare("UPDATE solves SET penalty = ? WHERE id = ?");
  const remove = db.prepare("DELETE FROM solves WHERE id = ?");

  function checkId(id: string) {
    if (!UUID.test(id)) throw new InvalidRequest("Solve id must be a uuid");
  }

  return {
    list: (): Solve[] => (selectAll.all() as unknown as SolveRow[]).map(toSolve),

    /** Saves a solve. Saving an existing id again returns it as it is (its penalty changes by patch). */
    put(id: string, body: unknown): Solve {
      checkId(id);
      const { caseId, ms, scramble, penalty = "ok" } = parseSolveBody(body);
      if (!caseIds.has(caseId)) throw new InvalidRequest(`Unknown PLL case ${caseId}`);
      insert.run(id, caseId, ms, penalty, scramble, new Date().toISOString());
      return toSolve(selectOne.get(id) as unknown as SolveRow);
    },

    /** Sets a solve's penalty. */
    patch(id: string, body: unknown): Solve {
      checkId(id);
      const { penalty } = parsePatchBody(body);
      if (!updatePenalty.run(penalty, id).changes) throw new InvalidRequest(`Unknown solve ${id}`);
      return toSolve(selectOne.get(id) as unknown as SolveRow);
    },

    remove(id: string): null {
      checkId(id);
      remove.run(id);
      return null;
    },
  };
}

function parsePenalty(penalty: unknown): Penalty {
  if (!PENALTIES.includes(penalty as Penalty)) throw new InvalidRequest(`penalty must be one of ${PENALTIES.join(", ")}`);
  return penalty as Penalty;
}

function parsePatchBody(body: unknown): PatchSolveBody {
  const { penalty, ...rest } = (body ?? {}) as Record<string, unknown>;
  const unknownKeys = Object.keys(rest);
  if (unknownKeys.length) throw new InvalidRequest(`Unknown field(s): ${unknownKeys.join(", ")}`);
  return { penalty: parsePenalty(penalty) };
}

function parseSolveBody(body: unknown): PutSolveBody {
  const { caseId, ms, scramble, penalty, ...rest } = (body ?? {}) as Record<string, unknown>;
  const unknownKeys = Object.keys(rest);
  if (unknownKeys.length) throw new InvalidRequest(`Unknown field(s): ${unknownKeys.join(", ")}`);
  if (typeof caseId !== "string") throw new InvalidRequest("caseId must be a string");
  if (typeof ms !== "number" || !Number.isInteger(ms) || ms <= 0 || ms > MAX_SOLVE_MS)
    throw new InvalidRequest(`ms must be a whole number of milliseconds, 1 to ${MAX_SOLVE_MS}`);
  if (typeof scramble !== "string" || scramble.length > 500) throw new InvalidRequest("scramble must be a string");
  return { caseId, ms, scramble, penalty: penalty === undefined ? "ok" : parsePenalty(penalty) };
}
