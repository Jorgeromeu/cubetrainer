// Settings: what the user picks once and expects everywhere (cube display, F2L's link
// kinds), as opposed to view state (filters, chart toggles: per browser) and user data (a
// tool's DB). Kept by the server host, one JSON object per owner, so every checkout,
// worktree and browser sees the same ones. packages/ui/settings/setting.ts is the client.
//
// An owner is a tool id (`f2l`: that tool's own settings) or `<library>.<name>` for
// settings a shared library owns and every tool using it shares (`ui.cube`). The server
// stores what it's given; the owner's code validates it (unknown or invalid: defaults).

export const SETTINGS_PATH = '/api/_/settings'

/** A tool id, or a library's `<library>.<name>`. */
export const SETTINGS_OWNER = /^[a-z0-9-]+(\.[a-z0-9-]+)?$/

/** Biggest settings object accepted, as JSON. */
export const MAX_SETTINGS_LENGTH = 65536

// GET /api/_/settings -> SettingsResponse
export interface SettingsResponse {
  /** Every owner's stored settings, as last put. */
  settings: Record<string, object>
}

// PUT /api/_/settings/:owner, body: the owner's whole settings object -> null
