import type { AppEnv } from "./env";

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// siteverify runs on the same Cloudflare edge the Worker does, so a slow call
// means something is wrong rather than far away. Kept well under the login
// path's own budget — a token we cannot verify is not a token we accept.
const VERIFY_TIMEOUT_MS = 5_000;

/**
 * Which form a token was minted for. Sent as `action` on the widget and
 * re-checked here so a token solved on the login page can't be replayed
 * against signup (or vice versa) — siteverify alone would accept either.
 */
export type TurnstileAction = "login" | "signup";

type SiteverifyResponse = {
  success?: boolean;
  action?: string;
  hostname?: string;
  "error-codes"?: string[];
};

/**
 * Turnstile is CONFIGURED-MEANS-ON: no `TURNSTILE_SECRET` ⇒ no verification,
 * matching the client, which renders no widget without `VITE_TURNSTILE_SITE_KEY`
 * and therefore sends no token. Both halves have to agree or local dev and the
 * test suites could never log in. Same shape as the R2 upload surfaces.
 *
 * The trade-off: an unset production secret is a silent hole, not an outage.
 * Neither half is checkable from the repo — the secret is a `wrangler secret`
 * and the site key is a Workers Builds build variable — so verify with
 * `wrangler secret list --env production` and the dashboard's build vars after
 * provisioning. Turnstile Analytics showing zero solves is the live tell.
 */
export function isTurnstileEnabled(env: AppEnv): boolean {
  return !!env.TURNSTILE_SECRET;
}

/**
 * Verifies one single-use token. Returns true only for a token that siteverify
 * accepts, that was minted for `action`, and that was solved on the host now
 * serving the request.
 *
 * Fails CLOSED on a malformed body, a non-2xx, a timeout or a throw: unlike the
 * rate limiter (which fails open so a binding outage can't brick anonymous
 * messaging), an unverifiable captcha token carries no evidence at all, and the
 * cheap IP-keyed guards in front of this one still apply.
 *
 * Callers must run this AFTER the denylist + rate-limit checks and BEFORE any
 * Argon2 work — it costs one round trip, and it exists to protect the hash.
 */
export async function verifyTurnstile(
  env: AppEnv,
  token: unknown,
  action: TurnstileAction,
  request: { host: string | undefined; ip: string },
): Promise<boolean> {
  if (!isTurnstileEnabled(env)) return true;

  if (typeof token !== "string" || !token || token.length > 2048) return false;

  let body: SiteverifyResponse;
  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET ?? "",
        response: token,
        remoteip: request.ip,
      }),
    });
    if (!res.ok) return false;
    body = (await res.json()) as SiteverifyResponse;
  } catch {
    return false;
  }

  // Compared against the request's own Host rather than an env allowlist of
  // hostnames: the two can't drift, and a production Worker can't accidentally
  // accept a token solved on localhost. The CSRF check pins Origin === Host
  // upstream, which is what makes the header trustworthy here.
  //
  // This relies on siteverify reporting the hostname the challenge was actually
  // solved on, NOT the widget's configured entry — verified against the live
  // widget: a page served from `sub.localhost` with only `localhost` configured
  // came back `hostname: "sub.localhost"`. The widget lists the apex
  // `umamin.link`, and subdomains are covered automatically, so production
  // reports `www.umamin.link` and staging `dev.umamin.link`.
  const expected = hostnameOf(request.host);
  return (
    body.success === true &&
    body.action === action &&
    !!body.hostname &&
    !!expected &&
    body.hostname === expected
  );
}

/**
 * The Host header minus any port — siteverify reports a bare hostname, so
 * `localhost:5173` would never match. Normalized in one place for the same
 * reason IPs are: two spellings of one host that silently never compare equal
 * is the failure mode.
 */
function hostnameOf(host: string | undefined): string | null {
  if (!host) return null;
  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    return end === -1 ? null : host.slice(0, end + 1);
  }
  const [hostname] = host.split(":");
  return hostname || null;
}
