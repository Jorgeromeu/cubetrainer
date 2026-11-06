// Signing in, for a server reachable by others (hosted; see openspec/specs/foundation/
// deployment). Off unless AUTH_TOKEN is set, so local use needs nothing. With it set, every
// API request needs the token: as `Authorization: Bearer <token>` (an iOS app, scripts) or
// the cookie GET /login?token=<token> sets (the web app, once per browser). The built app's
// files stay public: they hold no data.
import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

const COOKIE = "cubetrainer_token";
/** A year: sign in once per browser. */
const COOKIE_MAX_AGE_S = 365 * 24 * 3600;

const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

function cookieToken(req: IncomingMessage): string | undefined {
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === COOKIE) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

export function auth(token: string | undefined) {
  return {
    enabled: !!token,
    /** True if the request may use the API. */
    allows(req: IncomingMessage): boolean {
      if (!token) return true;
      const header = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
      const given = header ?? cookieToken(req);
      return !!given && same(given, token);
    },
    /** GET /login?token=...: sets the cookie and goes to the app, or answers 401. */
    login(req: IncomingMessage, res: ServerResponse, url: URL) {
      const given = url.searchParams.get("token") ?? "";
      if (!token || !same(given, token)) {
        res.writeHead(401, { "Content-Type": "text/plain; charset=utf-8" }).end("Wrong or missing token");
        return;
      }
      const secure = req.headers["x-forwarded-proto"] === "https" || (req.socket as { encrypted?: boolean }).encrypted;
      res
        .writeHead(302, {
          Location: "/",
          "Set-Cookie": `${COOKIE}=${encodeURIComponent(given)}; Path=/; Max-Age=${COOKIE_MAX_AGE_S}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`,
        })
        .end();
    },
  };
}
