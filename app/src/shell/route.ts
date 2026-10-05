// Hash-based routes, so the app works as plain static files: #/<trainerId>/<path...>,
// where the path is the trainer's own (common/trainer.ts). #/ and any hash that doesn't
// start with a trainer id (older links, from before trainers had a prefix) go to the
// default trainer, with the whole hash as its path.
import type { Trainer } from '../common/trainer.ts'
import { DEFAULT_TRAINER, TRAINERS } from './trainers.ts'

export interface Route {
  trainer: Trainer
  path: string[]
}

export function parseHash(): Route {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  const trainer = TRAINERS.find((t) => t.id === parts[0])
  return trainer ? { trainer, path: parts.slice(1) } : { trainer: DEFAULT_TRAINER, path: parts }
}
