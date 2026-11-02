# Tasks

Each group is one commit. After each: `npm run build` in `app/`, start the server, smoke-test every tool.

## 1. Scaffolding

- [ ] 1.1 Root `package.json` with npm workspaces (`app`, `server`, `catalog-builder`, `packages/*`); one `npm install` at the root
- [ ] 1.2 Widen Vite `server.fs.allow` and the `tsconfig` includes to `packages/` and `tools/`
- [ ] 1.3 Check that Node's type stripping runs `.ts` from `packages/` and `tools/` (not under `node_modules`)
- [ ] 1.4 Import boundary check script (`check:imports`), wired into the app build; starts with the rules from the architecture spec

## 2. packages/core

- [ ] 2.1 Move `shared/cube.ts` and the cross-cutting catalog types
- [ ] 2.2 Move pure logic out of `app/src/common/`: notation parsing (`notation/moves.ts`, `moveInfo.ts`), solve time and averages (`solveTime.ts`), drill history and picks (`drill/`), API client (`api.ts`)
- [ ] 2.3 Merge `Penalty`/`Solve` basics from `shared/pll` and `shared/stats` into one core definition
- [ ] 2.4 Fix the sequence joining so it compares whole move families, not first characters (cube-notation REVIEW)

## 3. packages/ui

- [ ] 3.1 Move `app/src/shell/` (except the registry) and the React parts of `app/src/common/` (cube, notation display, move hint, icons, ui, stealth, settings blocks)
- [ ] 3.2 Move `PllIcon` and `SlotIcon` here; drop `SlotIcon` if it is still unused
- [ ] 3.3 Split `app/src/index.css`: theme tokens, base, shell, stealth and shared components to `packages/ui`; the rest stays tagged per tool until group 4 moves it

## 4. Tools

- [ ] 4.1 `tools/f2l/`: contract (from `shared/f2l`), app (from `app/src/trainers/f2l`), server (from `server/src/trainers/f2l`, migrations included)
- [ ] 4.2 `tools/pll/`: same (its contract exposes nothing yet; `exposes` is defined but empty everywhere)
- [ ] 4.3 `tools/pll-compare/`: same
- [ ] 4.4 `tools/stats/`: same
- [ ] 4.5 Each tool's styles to `tools/<id>/app/<id>.css`, imported by its view; no tool-specific rule left in ui's CSS
- [ ] 4.6 App and server registries point at `tools/<id>/`; `app/` and `server/` keep only host code

## 5. Cleanup

- [ ] 5.0 Rename the generic concept trainer → tool in code: `Trainer`/`ServerTrainer` → `Tool`/`ServerTool`, `TRAINERS` → `TOOLS`, `trainer-switch` CSS classes, and the strings "Cube display · all trainers" and "The <id> trainer failed to start" (the specs already say "tool"). Tool names like "Scramble trainer" stay, and so do the `cubetrainer.*` storage keys

- [ ] 5.1 Delete `shared/`, `app/src/common/`, `app/src/trainers/`, `server/src/trainers/`
- [ ] 5.2 Make `check:imports` strict (no allowlist left)
- [ ] 5.3 Update root, app and server READMEs; replace `docs/requirements.md` with a pointer to `openspec/specs/`
- [ ] 5.4 Verify migrations still apply to existing `data/*.sqlite` (copy the files first) and that no data changed
