// The F2L tool's API: main algs, alg statuses, notes, video links and your own algs (types in tools/f2l/contract.ts).
//
//   GET   /api/f2l/progress               -> ProgressResponse
//   PUT   /api/f2l/progress/:slotCaseId   PutProgressBody -> SlotCaseProgress | null
//   PATCH /api/f2l/algs/:kind/:id         PatchAlgBody -> AlgState | null
//   PUT   /api/f2l/notes/:id              PutNoteBody -> Note | null
//   PUT   /api/f2l/videos/:kind/:id       PutVideoBody -> VideoLink | null
//   PUT   /api/f2l/user-algs/:id          PutUserAlgBody -> UserAlg
//   PATCH /api/f2l/user-algs/:id          PatchUserAlgBody -> UserAlg
//   DELETE /api/f2l/user-algs/:id         -> null
//
// Exposed (f2lExposes): active-cases -> ActiveCasesResponse
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Catalog } from "../catalog/catalog.ts";
import { f2lExposes, type ActiveCasesResponse, type ProgressResponse } from "../contract.ts";
import { implement, type ApiRoute, type ServerTool } from "../../../server/src/tool.ts";
import { algRefFrom, progressRepository } from "./progress.ts";

export const f2lTool: ServerTool = {
  id: "f2l",
  start({ repoRoot, openDb }) {
    const catalog = JSON.parse(readFileSync(join(repoRoot, "tools/f2l/catalog/f2l.json"), "utf8")) as Catalog;
    const progress = progressRepository(openDb(join(import.meta.dirname, "migrations")), catalog);
    const routes = [
      {
        method: "GET",
        path: "/progress",
        handle: () =>
          ({
            progress: progress.list(),
            algs: progress.listAlgStates(),
            notes: progress.listNotes(),
            videos: progress.listVideos(),
            userAlgs: progress.listUserAlgs(),
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
      {
        method: "PUT",
        path: "/videos/:kind/:id",
        handle: ({ params, body }) => progress.putVideo(algRefFrom(params.kind, params.id), body),
      },
      {
        method: "PUT",
        path: "/user-algs/:id",
        handle: ({ params, body }) => progress.putUserAlg(params.id, body),
      },
      {
        method: "PATCH",
        path: "/user-algs/:id",
        handle: ({ params, body }) => progress.patchUserAlg(params.id, body),
      },
      {
        method: "DELETE",
        path: "/user-algs/:id",
        handle: ({ params }) => progress.deleteUserAlg(params.id),
      },
    ] satisfies ApiRoute[];
    return { routes, exposes: [implement(f2lExposes.activeCases, () => activeCases(progress))] };
  },
};

function activeCases(progress: ReturnType<typeof progressRepository>): ActiveCasesResponse {
  const cases = new Map<string, ActiveCasesResponse["cases"][number]>();
  const entry = (slotCaseId: string) => {
    let c = cases.get(slotCaseId);
    if (!c) cases.set(slotCaseId, (c = { slotCaseId, mainAlg: null, algs: [] }));
    return c;
  };
  for (const p of progress.list()) entry(p.slotCaseId).mainAlg = p.mainAlg;
  for (const a of progress.listAlgStates()) entry(a.slotCaseId).algs.push({ alg: a.alg, status: a.status });
  return { cases: [...cases.values()].sort((a, b) => a.slotCaseId.localeCompare(b.slotCaseId)) };
}
