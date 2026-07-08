// Pure client-IP extraction. No `server-only`, no next/headers import, so it can
// be shared by route handlers and (if added later) middleware.
//
// Prefer the headers Vercel's edge sets itself (`x-real-ip` /
// `x-vercel-forwarded-for`) — these are NOT client-spoofable. The left-most
// `x-forwarded-for` entry is a last-resort fallback; a constant covers local dev.
export function extractClientIp(
  get: (name: string) => string | null | undefined,
): string {
  const ip =
    get("x-real-ip")?.trim() ||
    get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    get("x-forwarded-for")?.split(",")[0]?.trim();
  return ip || "127.0.0.1";
}
