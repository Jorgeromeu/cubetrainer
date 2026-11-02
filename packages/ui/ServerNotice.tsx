// The bottom-right notice tools with stored data show (see the architecture spec, "App works
// without the server"): quiet while the server is unreachable, red briefly after a save it
// refused.
import type { Load } from '../core/api.ts'

/**
 * `offline` says what is missing without a server, e.g. "No server · progress not loaded".
 * `error` is the last error: why the server is unreachable, or the refused save's message.
 */
export function ServerNotice({ load, error, offline }: { load: Load; error?: string; offline: string }) {
  if (load === 'offline')
    return (
      <div className="server-notice" role="status" title={`${error ?? 'Server not reachable'}. Retrying in the background.`}>
        {offline}
      </div>
    )
  if (load === 'ready' && error)
    return (
      <div className="server-notice save-error" role="alert">
        {error}
      </div>
    )
  return null
}
