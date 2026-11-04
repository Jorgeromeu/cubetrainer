// What a tool gives the server (tools.ts lists them). A tool is standalone: it owns
// everything under /api/<id>/ and its own SQLite file, data/<id>.sqlite, so adding or
// changing one can't touch another's routes or data. Other tools' data it only reads,
// through their exposed calls (packages/core/exposed.ts), declared in `uses`.
import type { DatabaseSync } from "node:sqlite";
import type { CapabilityName, CapabilityResult, Exposed, ExposedArgs } from "../../packages/core/exposed.ts";

/** A request the client got wrong; becomes a 400 with its message. */
export class InvalidRequest extends Error {}

/**
 * A request body as a JSON object with only `fields` (any of them may be missing): anything
 * else is refused (foundation/user-data, "Strict request bodies"). Check each field's type
 * and limits after.
 */
export function bodyOf(body: unknown, fields: readonly string[]): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) throw new InvalidRequest("Body must be a JSON object");
  const unknown = Object.keys(body).filter((k) => !fields.includes(k));
  if (unknown.length) throw new InvalidRequest(`Unknown field(s): ${unknown.join(", ")}`);
  return body as Record<string, unknown>;
}

/** Runs `run` in a transaction: committed if it returns, rolled back if it throws. */
export function transaction<T>(db: DatabaseSync, run: () => T): T {
  db.exec("BEGIN");
  try {
    const result = run();
    db.exec("COMMIT");
    return result;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiRoute {
  method: Method;
  /** Under /api/<tool id>; ":name" segments are params, e.g. "/algs/:kind/:id". */
  path: string;
  /**
   * Returns the response body, sent as JSON with a 200. Throw InvalidRequest (below)
   * for a 400; anything else thrown is a 500. `body` is the parsed JSON body (undefined
   * for GET and DELETE).
   */
  handle(request: { params: Record<string, string>; body: unknown }): unknown;
}

/** How a tool answers one of its own exposed calls. Build it with implement(). */
export interface Implementation {
  call: Exposed<unknown>;
  handle(args: ExposedArgs): unknown;
}

export const implement = <Result, Args extends ExposedArgs>(
  call: Exposed<Result, Args>,
  handle: (args: Partial<Args>) => Result,
): Implementation => ({ call: call as Exposed<unknown>, handle: handle as (args: ExposedArgs) => unknown });

export interface ToolContext {
  /** The repo root, for reading catalog/ etc. */
  repoRoot: string;
  /**
   * Opens this tool's own DB (data/<id>.sqlite) and applies its migrations: the
   * NNN_*.sql files in `migrationsDir`, in order, each once (see db.ts).
   */
  openDb(migrationsDir: string): DatabaseSync;
  /**
   * Reads another tool's exposed call, in-process. Undefined when that tool isn't
   * installed or failed to start: other tools are optional, so "no data" is normal.
   * Its id must be in this tool's `uses`. Call it while handling a request, not at start.
   */
  read<Result, Args extends ExposedArgs>(call: Exposed<Result, Args>, args?: Partial<Args>): Result | undefined;
  /** Every installed provider's result for a capability (which must be in `uses`). */
  gather<C extends CapabilityName>(capability: C, args?: ExposedArgs): CapabilityResult<C>[];
}

/** What a tool's start() gives back. */
export interface StartedTool {
  routes: ApiRoute[];
  /** Implementations of the calls its contract exposes. */
  exposes?: Implementation[];
}

export interface ServerTool {
  /** The same id as the app's tool: the API prefix and the DB file name. */
  id: string;
  /** Tool ids and capability names whose exposed calls it reads (ctx.read / ctx.gather). */
  uses?: readonly string[];
  /** Called once at startup. If it throws, only this tool is disabled (503s). */
  start(context: ToolContext): StartedTool;
}
