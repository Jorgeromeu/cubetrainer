// Exposed calls: how tools read each other's data. A tool is standalone (its own routes,
// its own DB), but it can offer read-only calls for other tools: the timer exposes its
// solves, F2L the cases you're working on. Only the owner ever writes its data.
//
// A call is declared once, in the owning tool's contract.ts, with exposed() (or
// provides(), for a capability). It's then readable two ways, with the same result:
//   - in-process, by another tool's server: ctx.read(call, args) (server/src/tool.ts)
//   - over HTTP, by any tool's app: GET /api/<tool>/exposed/<name>?args (packages/ui/exposed.ts)
//
// A capability is an interface several tools can provide (e.g. "case-observations": cases
// seen and how fast they went, from real solves or from drills). A consumer asks for the
// capability, not for a tool, and gets one result per installed tool that provides it.
//
// Exposed calls only grow: add fields or new calls, never change what a field means. A
// breaking change is a new call.
import type { CaseObservations } from './observations.ts'

/** Arguments are query-string values, so strings; a missing one is undefined. */
export type ExposedArgs = Record<string, string | undefined>

/** Every capability: its name and what each provider returns. */
export interface Capabilities {
  'case-observations': CaseObservations
}
export type CapabilityName = keyof Capabilities

/** A read-only call a tool offers. `Result` and `Args` are only types (nothing at runtime). */
export interface Exposed<Result, Args extends ExposedArgs = ExposedArgs> {
  readonly tool: string
  readonly name: string
  /** The capability this call provides, if any. */
  readonly capability?: CapabilityName
  readonly __types?: { result: Result; args: Args }
}

/** Declares a call `tool` exposes. Call names: lowercase letters, digits and dashes. */
export const exposed = <Result, Args extends ExposedArgs = ExposedArgs>(tool: string, name: string): Exposed<Result, Args> => ({
  tool,
  name,
})

/** Declares a call that provides `capability`: its result is the capability's. */
export const provides = <C extends CapabilityName, Args extends ExposedArgs = ExposedArgs>(
  tool: string,
  name: string,
  capability: C,
): Exposed<Capabilities[C], Args> => ({ tool, name, capability })

/** One provider's answer to a capability. */
export interface CapabilityResult<C extends CapabilityName> {
  tool: string
  result: Capabilities[C]
}

// GET /api/_/capabilities/<name>?args -> CapabilityResponse: every provider's result.
export interface CapabilityResponse<C extends CapabilityName> {
  results: CapabilityResult<C>[]
}

const query = (args?: ExposedArgs) => {
  const defined = Object.entries(args ?? {}).filter((e): e is [string, string] => e[1] !== undefined)
  return defined.length ? '?' + new URLSearchParams(defined).toString() : ''
}

export const exposedPath = (call: Exposed<unknown, ExposedArgs>, args?: ExposedArgs) =>
  `/api/${call.tool}/exposed/${call.name}${query(args)}`

export const capabilityPath = (capability: CapabilityName, args?: ExposedArgs) =>
  `/api/_/capabilities/${capability}${query(args)}`
