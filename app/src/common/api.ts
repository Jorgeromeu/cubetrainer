// Talking to the server's API (../server): JSON requests that tell "the server refused"
// apart from "there's no server".

const TIMEOUT_MS = 5000

/** The server answered and refused the request (a 4xx/5xx with its JSON error). */
export class Rejected extends Error {}

/**
 * Throws Rejected when the server refused the request, and a plain Error when there's no
 * server to talk to: network failure, timeout, a proxy error, or something that isn't our
 * API answering (e.g. a static host returning index.html).
 */
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch (e) {
    throw new Error((e as Error).name === 'TimeoutError' ? 'timed out' : 'not reachable')
  }
  const body: unknown = await res.json().catch(() => undefined)
  const error = (body as { error?: unknown } | undefined)?.error
  if (!res.ok) {
    if (typeof error === 'string') throw new Rejected(error)
    throw new Error(`not reachable (${res.status})`)
  }
  if (body === undefined) throw new Error('not answering as an API')
  return body as T
}
