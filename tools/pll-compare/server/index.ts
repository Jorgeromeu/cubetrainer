// The PLL compare tool's API: named sets of cubes (types in ../contract.ts).
//
//   GET    /api/pll-compare/sets       -> SetsResponse
//   PUT    /api/pll-compare/sets/:id   PutSetBody -> CompareSet
//   DELETE /api/pll-compare/sets/:id   -> null
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PllCatalog } from "../../../packages/core/catalog/pll.ts";
import type { SetsResponse } from "../contract.ts";
import type { ServerTool } from "../../../server/src/tool.ts";
import { setsRepository } from "./sets.ts";

export const pllCompareTool: ServerTool = {
  id: "pll-compare",
  routes({ repoRoot, openDb }) {
    const catalog = JSON.parse(readFileSync(join(repoRoot, "catalog/pll.json"), "utf8")) as PllCatalog;
    const sets = setsRepository(openDb(join(import.meta.dirname, "migrations")), catalog);
    return [
      {
        method: "GET",
        path: "/sets",
        handle: () => ({ sets: sets.list() }) satisfies SetsResponse,
      },
      {
        method: "PUT",
        path: "/sets/:id",
        handle: ({ params, body }) => sets.put(params.id, body),
      },
      {
        method: "DELETE",
        path: "/sets/:id",
        handle: ({ params }) => sets.remove(params.id),
      },
    ];
  },
};
