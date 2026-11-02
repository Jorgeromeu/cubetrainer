// Every trainer with server-side data. Adding one: a folder under trainers/ whose index.ts
// exports a ServerTrainer (trainer.ts), listed here. Trainers that store nothing don't
// need an entry.
import type { ServerTrainer } from "./tool.ts";
import { f2lTrainer } from "../../tools/f2l/server/index.ts";
import { pllTrainer } from "../../tools/pll/server/index.ts";
import { pllCompareTrainer } from "../../tools/pll-compare/server/index.ts";
import { statsTrainer } from "../../tools/stats/server/index.ts";

export const TRAINERS: ServerTrainer[] = [f2lTrainer, pllTrainer, pllCompareTrainer, statsTrainer];
