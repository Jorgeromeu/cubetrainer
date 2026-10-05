// The F2L trainer's API: main algs, alg statuses and notes (types in shared/f2l/progress.ts).
//
//   GET   /api/f2l/progress               -> ProgressResponse
//   PUT   /api/f2l/progress/:slotCaseId   PutProgressBody -> SlotCaseProgress | null
//   PATCH /api/f2l/algs/:kind/:id         PatchAlgBody -> AlgState | null
//   PUT   /api/f2l/notes/:id              PutNoteBody -> Note | null
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Catalog } from "../../../../shared/f2l/catalog.ts";
import type { ProgressResponse } from "../../../../shared/f2l/progress.ts";
import type { ServerTrainer } from "../../trainer.ts";
import { algRefFrom, progressRepository } from "./progress.ts";

export const f2lTrainer: ServerTrainer = {
  id: "f2l",
  routes({ repoRoot, openDb }) {
    const catalog = JSON.parse(readFileSync(join(repoRoot, "catalog/f2l.json"), "utf8")) as Catalog;
    const progress = progressRepository(openDb(join(import.meta.dirname, "migrations")), catalog);
    return [
      {
        method: "GET",
        path: "/progress",
        handle: () =>
          ({
            progress: progress.list(),
            algs: progress.listAlgStates(),
            notes: progress.listNotes(),
          }) satisfies ProgressResponse,
      },
      {
        method: "PUT",
        path: "/progress/:slotCaseId",
        handle: ({ params, body }) => progress.put(params.slotCaseId, body),
      },
      {
        method: "PATCH",
        path: "/algs/:kind/:id",
        handle: ({ params, body }) => progress.patchAlg(algRefFrom(params.kind, params.id), body),
      },
      {
        method: "PUT",
        path: "/notes/:id",
        handle: ({ params, body }) => progress.putNote(params.id, body),
      },
    ];
  },
};
