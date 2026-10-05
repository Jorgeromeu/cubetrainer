import { useProgress } from './progress.ts'

/**
 * A small notice in the bottom-right corner: while the server is unreachable (the app
 * works, minus progress), or briefly after a save the server refused.
 */
export function ServerNotice() {
  const { load, error } = useProgress()
  if (load === 'offline')
    return (
      <div className="server-notice" role="status" title={`${error ?? 'Server not reachable'}. Retrying in the background.`}>
        No server · progress not loaded
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
