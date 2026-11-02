// Hash-based routes, so the app works as plain static files: #/<trainerId>/<path...>,
// where the path is the trainer's own (../tool.ts). #/ and any hash that doesn't
// start with a trainer id (older links, from before trainers had a prefix) go to the
// default trainer (the first one listed), with the whole hash as its path.
import type { Trainer } from '../tool.ts'

export interface Route {
  trainer: Trainer
  path: string[]
}

export function parseHash(trainers: readonly Trainer[]): Route {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  const trainer = trainers.find((t) => t.id === parts[0])
  return trainer ? { trainer, path: parts.slice(1) } : { trainer: trainers[0], path: parts }
}
