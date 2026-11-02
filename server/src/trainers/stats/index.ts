// The stats trainer's API: solves imported from timers' exports (types in shared/stats/solves.ts).
//
//   GET    /api/stats/solves   -> SolvesResponse
//   PATCH  /api/stats/solves/:id   PatchSolveBody -> Solve
//   POST   /api/stats/import   ImportBody -> ImportResponse
//   GET    /api/stats/milestones       -> MilestonesResponse
//   PUT    /api/stats/milestones/:id   PutMilestoneBody -> Milestone
//   DELETE /api/stats/milestones/:id   -> null
import { join } from "node:path";
import type { MilestonesResponse, SolvesResponse } from "../../../../shared/stats/solves.ts";
import type { ServerTrainer } from "../../trainer.ts";
import { milestonesRepository } from "./milestones.ts";
import { solvesRepository } from "./solves.ts";

export const statsTrainer: ServerTrainer = {
  id: "stats",
  routes({ openDb }) {
    const db = openDb(join(import.meta.dirname, "migrations"));
    const solves = solvesRepository(db);
    const milestones = milestonesRepository(db);
    return [
      {
        method: "GET",
        path: "/solves",
        handle: () => ({ solves: solves.list() }) satisfies SolvesResponse,
      },
      {
        method: "PATCH",
        path: "/solves/:id",
        handle: ({ params, body }) => solves.patch(params.id, body),
      },
      {
        method: "POST",
        path: "/import",
        handle: ({ body }) => solves.import(body),
      },
      {
        method: "GET",
        path: "/milestones",
        handle: () => ({ milestones: milestones.list() }) satisfies MilestonesResponse,
      },
      {
        method: "PUT",
        path: "/milestones/:id",
        handle: ({ params, body }) => milestones.put(params.id, body),
      },
      {
        method: "DELETE",
        path: "/milestones/:id",
        handle: ({ params }) => milestones.remove(params.id),
      },
    ];
  },
};
