# Cubetrainer

Layout, import rules and how tools share data: `README.md`. Behaviour: `openspec/specs/`.
New tool: `npm run new-tool <id> [-- --server]` (the smallest tool that builds, following the
conventions), then read `openspec/specs/foundation/` before adding to it.

## Worktrees and data

`data/*.sqlite` in the main checkout is the user's real data. Never write test data there.

- A worktree gets its own copy on its first `npm run dev` / `npm run server`: main's DBs are
  copied into the worktree's `data/`, and a free pair of ports is picked and kept in its
  `.dev.json` (gitignored). Main keeps 3001 / 5173. The app's top bar shows the branch and
  whose data it uses whenever it isn't `main` with main's data.
- `npm run data:pull` (worktree server stopped) replaces the worktree's data with a fresh copy
  of main's. Do it after editing a migration that isn't on main yet: the copy already ran the
  old version.
- Migrations travel with the code. One that isn't on main yet may be edited or renumbered;
  once merged, never.
- **Finishing a worktree:** merge it, restart main's server (so main's DBs get the new
  migrations), then run `npm run data:push` from the worktree before removing it. It adds the
  rows main doesn't have and copies DBs of tools new in the worktree, backing main up first.
  It never overwrites or deletes: edits to records that already existed stay behind.
  `npm run data:diff` shows what it would add.

## Checks

`npm run check`: build (import check, type checks, app build), lint and tests.
