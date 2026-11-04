// The timer tool's API: every full solve (timed here or imported from another timer's
// export), the imports, and timeline milestones (types in ../contract.ts).
//
//   GET    /api/timer/solves          -> SolvesResponse
//   PUT    /api/timer/solves/:id      PutSolveBody -> Solve (a solve timed here)
//   PATCH  /api/timer/solves/:id      PatchSolveBody -> Solve
//   DELETE /api/timer/solves/:id      -> null (solves timed here only)
//   POST   /api/timer/import          ImportBody -> ImportResponse
//   GET    /api/timer/imports         -> ImportsResponse
//   DELETE /api/timer/imports/:id     -> null (undoes it)
//   GET    /api/timer/milestones      -> MilestonesResponse
//   PUT    /api/timer/milestones/:id  PutMilestoneBody -> Milestone
//   DELETE /api/timer/milestones/:id  -> null
//
// Exposed (timerExposes): solves -> SolvesResponse
import { join } from "node:path";
import { timerExposes, type ImportsResponse, type MilestonesResponse, type SolvesResponse } from "../contract.ts";
import { implement, type ServerTool } from "../../../server/src/tool.ts";
import { milestonesRepository } from "./milestones.ts";
import { solvesRepository } from "./solves.ts";

export const timerTool: ServerTool = {
  id: "timer",
  start({ openDb }) {
    const db = openDb(join(import.meta.dirname, "migrations"));
    const solves = solvesRepository(db);
    const milestones = milestonesRepository(db);
    return {
      routes: [
        { method: "GET", path: "/solves", handle: () => ({ solves: solves.list() }) satisfies SolvesResponse },
        { method: "PUT", path: "/solves/:id", handle: ({ params, body }) => solves.put(params.id, body) },
        { method: "PATCH", path: "/solves/:id", handle: ({ params, body }) => solves.patch(params.id, body) },
        { method: "DELETE", path: "/solves/:id", handle: ({ params }) => solves.remove(params.id) },
        { method: "POST", path: "/import", handle: ({ body }) => solves.import(body) },
        { method: "GET", path: "/imports", handle: () => ({ imports: solves.imports() }) satisfies ImportsResponse },
        { method: "DELETE", path: "/imports/:id", handle: ({ params }) => solves.removeImport(params.id) },
        { method: "GET", path: "/milestones", handle: () => ({ milestones: milestones.list() }) satisfies MilestonesResponse },
        { method: "PUT", path: "/milestones/:id", handle: ({ params, body }) => milestones.put(params.id, body) },
        { method: "DELETE", path: "/milestones/:id", handle: ({ params }) => milestones.remove(params.id) },
      ],
      exposes: [implement(timerExposes.solves, () => ({ solves: solves.list() }))],
    };
  },
};
