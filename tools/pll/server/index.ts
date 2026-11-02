// The PLL trainer's API: timed solves (types in shared/pll/solves.ts).
//
//   GET    /api/pll/solves       -> SolvesResponse
//   PUT    /api/pll/solves/:id   PutSolveBody -> Solve
//   PATCH  /api/pll/solves/:id   PatchSolveBody -> Solve
//   DELETE /api/pll/solves/:id   -> null
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PllCatalog } from "../../../packages/core/catalog/pll.ts";
import type { SolvesResponse } from "../contract.ts";
import type { ServerTrainer } from "../../../server/src/tool.ts";
import { solvesRepository } from "./solves.ts";

export const pllTrainer: ServerTrainer = {
  id: "pll",
  routes({ repoRoot, openDb }) {
    const catalog = JSON.parse(readFileSync(join(repoRoot, "catalog/pll.json"), "utf8")) as PllCatalog;
    const solves = solvesRepository(openDb(join(import.meta.dirname, "migrations")), catalog);
    return [
      {
        method: "GET",
        path: "/solves",
        handle: () => ({ solves: solves.list() }) satisfies SolvesResponse,
      },
      {
        method: "PUT",
        path: "/solves/:id",
        handle: ({ params, body }) => solves.put(params.id, body),
      },
      {
        method: "PATCH",
        path: "/solves/:id",
        handle: ({ params, body }) => solves.patch(params.id, body),
      },
      {
        method: "DELETE",
        path: "/solves/:id",
        handle: ({ params }) => solves.remove(params.id),
      },
    ];
  },
};
