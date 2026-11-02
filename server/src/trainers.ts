// Every trainer with server-side data. Adding one: a folder under trainers/ whose index.ts
// exports a ServerTrainer (trainer.ts), listed here. Trainers that store nothing don't
// need an entry.
import type { ServerTrainer } from "./trainer.ts";
import { f2lTrainer } from "./trainers/f2l/index.ts";
import { pllTrainer } from "./trainers/pll/index.ts";
import { pllCompareTrainer } from "./trainers/pll-compare/index.ts";
import { statsTrainer } from "./trainers/stats/index.ts";

export const TRAINERS: ServerTrainer[] = [f2lTrainer, pllTrainer, pllCompareTrainer, statsTrainer];
