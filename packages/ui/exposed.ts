// Reading another tool's exposed calls from a tool's app (packages/core/exposed.ts says
// what they are). The call's declaration comes from the owning tool's contract.ts, the
// only part of another tool an app may import. Undefined when that tool isn't installed:
// other tools are optional, so "no data" is normal.
import { request, Rejected } from '../core/api.ts'
import {
  capabilityPath,
  exposedPath,
  type CapabilityName,
  type CapabilityResponse,
  type CapabilityResult,
  type Exposed,
  type ExposedArgs,
} from '../core/exposed.ts'

/** A call's result; undefined if its tool isn't there. Throws like request() otherwise. */
export async function readExposed<Result, Args extends ExposedArgs>(call: Exposed<Result, Args>, args?: Partial<Args>): Promise<Result | undefined> {
  try {
    return await request<Result>(exposedPath(call, args))
  } catch (e) {
    if (e instanceof Rejected && /not found/i.test(e.message)) return undefined
    throw e
  }
}

/** Every installed provider's result for a capability. */
export async function gatherCapability<C extends CapabilityName>(capability: C, args?: ExposedArgs): Promise<CapabilityResult<C>[]> {
  return (await request<CapabilityResponse<C>>(capabilityPath(capability, args))).results
}
