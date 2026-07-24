import type { Context } from "hono";

// Bearer-authed requests (native app) carry no Origin and are exempt from the
// CSRF origin check — the token itself is the credential and isn't attached
// ambiently by a browser (plan "Mobile-ready adjustments").
export function isBearerAuthed(c: Context): boolean {
  const auth = c.req.header("authorization");
  return !!auth && /^bearer\s+/i.test(auth);
}

// Origin === Host, the same same-origin check apps/www's proxy.ts enforced on
// every non-GET. A missing Origin or Host, or an unparseable Origin, fails.
export function originMatchesHost(c: Context): boolean {
  const origin = c.req.header("origin");
  const host = c.req.header("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// A request passes CSRF when: it's a safe method, OR it's bearer-authed, OR its
// Origin matches Host. Applied to cookie-authed and anonymous browser mutations
// alike (as proxy.ts did) while letting mobile bearer traffic through.
export function passesCsrf(c: Context): boolean {
  if (SAFE_METHODS.has(c.req.method)) return true;
  if (isBearerAuthed(c)) return true;
  return originMatchesHost(c);
}
