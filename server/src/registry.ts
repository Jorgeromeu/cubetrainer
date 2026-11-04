// Starts every tool and keeps what they offer: their routes and their exposed calls. It
// is what ctx.read and ctx.gather (tool.ts) go through, and what main.ts serves over HTTP.
import type { CapabilityName, CapabilityResult, ExposedArgs } from "../../packages/core/exposed.ts";
import { compileRoute, type CompiledRoute } from "./http.ts";
import type { Implementation, ServerTool, ToolContext } from "./tool.ts";

const ID = /^[a-z0-9-]+$/;

export type Mounted = { routes: CompiledRoute[]; exposes: Map<string, Implementation> } | { failure: string };

export class Registry {
  readonly mounted = new Map<string, Mounted>();

  /** `context` gives each tool its repo root and own DB; read/gather are added here. */
  constructor(tools: readonly ServerTool[], context: (id: string) => Pick<ToolContext, "repoRoot" | "openDb">) {
    for (const tool of tools) {
      const { id } = tool;
      if (!ID.test(id)) throw new Error(`Tool id must be lowercase letters, digits and dashes: ${id}`);
      if (this.mounted.has(id)) throw new Error(`Two tools with id ${id}`);
      try {
        const uses = new Set(tool.uses ?? []);
        const started = tool.start({
          ...context(id),
          read: (call, args) => {
            if (!uses.has(call.tool)) throw new Error(`Tool ${id} reads ${call.tool}/${call.name} without "${call.tool}" in its uses`);
            return this.call(call.tool, call.name, args ?? {}) as never;
          },
          gather: (capability, args) => {
            if (!uses.has(capability)) throw new Error(`Tool ${id} gathers ${capability} without it in its uses`);
            return this.gather(capability, args ?? {});
          },
        });
        const exposes = new Map<string, Implementation>();
        for (const impl of started.exposes ?? []) {
          if (impl.call.tool !== id) throw new Error(`Tool ${id} implements ${impl.call.tool}/${impl.call.name}, another tool's call`);
          if (!ID.test(impl.call.name)) throw new Error(`Exposed call names must be lowercase letters, digits and dashes: ${impl.call.name}`);
          if (exposes.has(impl.call.name)) throw new Error(`Tool ${id} implements ${impl.call.name} twice`);
          exposes.set(impl.call.name, impl);
        }
        this.mounted.set(id, { routes: started.routes.map(compileRoute), exposes });
      } catch (e) {
        console.error(`Tool ${id} failed to start and is disabled:`, e);
        this.mounted.set(id, { failure: `The ${id} tool failed to start (see the server log)` });
      }
    }
  }

  /** A tool's exposed call, or undefined when the tool or call isn't there (or the tool is down). */
  call(tool: string, name: string, args: ExposedArgs): unknown {
    const mounted = this.mounted.get(tool);
    if (!mounted || "failure" in mounted) return undefined;
    return mounted.exposes.get(name)?.handle(args);
  }

  /** Every running provider's result for a capability, in tool order. */
  gather<C extends CapabilityName>(capability: C, args: ExposedArgs): CapabilityResult<C>[] {
    const results: CapabilityResult<C>[] = [];
    for (const [tool, mounted] of this.mounted) {
      if ("failure" in mounted) continue;
      for (const impl of mounted.exposes.values())
        if (impl.call.capability === capability) results.push({ tool, result: impl.handle(args) as CapabilityResult<C>["result"] });
    }
    return results;
  }
}
