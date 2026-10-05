// What a trainer gives the server (trainers.ts lists them). A trainer is standalone: it
// owns everything under /api/<id>/ and its own SQLite file, data/<id>.sqlite, so adding
// or changing one can't touch another's routes or data.
import type { DatabaseSync } from "node:sqlite";

export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiRoute {
  method: Method;
  /** Under /api/<trainer id>; ":name" segments are params, e.g. "/algs/:kind/:id". */
  path: string;
  /**
   * Returns the response body, sent as JSON with a 200. Throw InvalidRequest (http.ts)
   * for a 400; anything else thrown is a 500. `body` is the parsed JSON body (undefined
   * for GET and DELETE).
   */
  handle(request: { params: Record<string, string>; body: unknown }): unknown;
}

export interface TrainerContext {
  /** The repo root, for reading catalog/ etc. */
  repoRoot: string;
  /**
   * Opens this trainer's own DB (data/<id>.sqlite) and applies its migrations: the
   * NNN_*.sql files in `migrationsDir`, in order, each once (see db.ts).
   */
  openDb(migrationsDir: string): DatabaseSync;
}

export interface ServerTrainer {
  /** The same id as the app's trainer: the API prefix and the DB file name. */
  id: string;
  /** Called once at startup. If it throws, only this trainer is disabled (503s). */
  routes(context: TrainerContext): ApiRoute[];
}
