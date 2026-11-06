// What the server says about where it runs, for the shell's branch badge (packages/ui/shell/
// DevBadge.tsx): which branch, which checkout (the main one or a worktree), which data.
// Served by the server host at DEV_INFO_PATH; scripts/devenv.ts works it out.

export const DEV_INFO_PATH = '/api/_/info'

export interface DevInfo {
  /** The checked-out branch, read live; a short commit hash when detached; absent when deployed (no git checkout). */
  branch?: string
  /** The main checkout or a git worktree of it. */
  checkout: 'main' | 'worktree'
  /** This checkout's folder. */
  root: string
  /** The data folder this server uses. */
  dataDir: string
  /** The main checkout's data folder: the user's real data. */
  mainDataDir: string
  /** When this data was copied from main (worktrees, after `npm run data:pull`). */
  copiedAt?: string
  /** Rows (and whole new DBs' rows) here that main's data doesn't have: what `npm run data:push` would add. */
  unpushed: number
  serverPort: number
}

/** The badge is hidden on `main` using main's data (normal use), and when deployed. */
export const isPlainMain = (info: DevInfo) => !info.branch || (info.branch === 'main' && info.dataDir === info.mainDataDir)
