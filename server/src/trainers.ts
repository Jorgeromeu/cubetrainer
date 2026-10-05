// Every trainer with server-side data. Adding one: a folder under trainers/ whose index.ts
// exports a ServerTrainer (trainer.ts), listed here. Trainers that store nothing (PLL)
// don't need an entry.
import type { ServerTrainer } from "./trainer.ts";
import { f2lTrainer } from "./trainers/f2l/index.ts";

export const TRAINERS: ServerTrainer[] = [f2lTrainer];
