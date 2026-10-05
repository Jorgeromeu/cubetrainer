// HTTP plumbing shared by every trainer's routes: JSON in and out, request errors, and
// matching a request to a route.
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ApiRoute } from "./trainer.ts";

/** A request the client got wrong; becomes a 400 with its message. */
export class InvalidRequest extends Error {}

export const json = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

export async function readJson(req: IncomingMessage): Promise<unknown> {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  try {
    return JSON.parse(raw);
  } catch {
    throw new InvalidRequest("Body must be JSON");
  }
}

export interface CompiledRoute extends ApiRoute {
  /** Matches the path under /api/<trainer id>; groups are the route's :params. */
  pattern: RegExp;
}

/** "/algs/:kind/:id" -> a pattern whose named groups are kind and id. */
export function compileRoute(route: ApiRoute): CompiledRoute {
  if (!route.path.startsWith("/")) throw new Error(`Route path must start with "/": ${route.path}`);
  const source = route.path
    .split("/")
    .map((part) => (part.startsWith(":") ? `(?<${part.slice(1)}>[^/]+)` : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    .join("/");
  return { ...route, pattern: new RegExp(`^${source}$`) };
}

/** The route for a path, with its decoded params; `methodMismatch` when only the method is wrong. */
export function matchRoute(routes: CompiledRoute[], method: string, path: string) {
  let methodMismatch = false;
  for (const route of routes) {
    const match = route.pattern.exec(path);
    if (!match) continue;
    if (route.method !== method) {
      methodMismatch = true;
      continue;
    }
    const params = Object.fromEntries(Object.entries(match.groups ?? {}).map(([k, v]) => [k, decodeURIComponent(v)]));
    return { route, params };
  }
  return { methodMismatch };
}
