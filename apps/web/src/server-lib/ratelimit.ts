import type { AppEnv } from "./env";

export const RATE_LIMIT_ERROR =
  "Too many requests. Please try again in a minute.";

// The sliding-window limiters that map onto Workers Rate Limiting bindings
// (plan fact #3). NOTE: `group-edit` (2/day) is intentionally NOT here — a
// 1-day period can't be expressed by the binding (period is 10|60s only), so it
// moves to Turso edit-window columns checked inside the edit action (Phase 2).
export type LimiterName =
  | "auth"
  | "message"
  | "write"
  | "group-join"
  | "read"
  | "read-shared"
  | "chat-connect"
  | "login-account";

const BINDING: Record<LimiterName, keyof Env> = {
  auth: "RL_AUTH",
  message: "RL_MESSAGE",
  write: "RL_WRITE",
  "group-join": "RL_GROUP_JOIN",
  read: "RL_READ",
  "read-shared": "RL_READ_SHARED",
  "chat-connect": "RL_CHAT_CONNECT",
  "login-account": "RL_LOGIN_ACCOUNT",
};

/**
 * Returns true if the request may proceed. FAIL-OPEN with a loud log when a
 * binding is missing — mirrors apps/www's posture (a limiter outage must never
 * brick core features incl. anonymous messaging; the CF WAF is the volumetric
 * backstop). Per-colo looseness is accepted (plan R10).
 */
export async function checkRateLimit(
  env: AppEnv,
  name: LimiterName,
  key: string,
): Promise<boolean> {
  const binding = env[BINDING[name]] as RateLimit | undefined;
  if (!binding) {
    console.error(
      `[ratelimit] binding ${BINDING[name]} missing — '${name}' is DISABLED (fail-open).`,
    );
    return true;
  }
  const { success } = await binding.limit({ key });
  return success;
}

// Per-IP read throttle for the DB-backed GET routes (withPublicRead/
// withPrivateRead). Keyed per IP like apps/www's `read` limiter — cache-miss
// scraping protection; CDN-cached hits never reach the handler.
export function checkReadRateLimit(env: AppEnv, ip: string): Promise<boolean> {
  return checkRateLimit(env, "read", `read:${ip}`);
}

// Signed-in readers get their own budget so a mobile carrier's NAT, where many
// phones share one public IP, doesn't throttle all of them as one client.
export function checkUserReadRateLimit(
  env: AppEnv,
  userId: string,
): Promise<boolean> {
  return checkRateLimit(env, "read", `read:u:${userId}`);
}

// Coarse per-IP ceiling for requests that carry a session token, checked before
// the session lookup so random tokens can't buy unlimited database reads.
export function checkSharedIpReadRateLimit(
  env: AppEnv,
  ip: string,
): Promise<boolean> {
  return checkRateLimit(env, "read-shared", `readip:${ip}`);
}
