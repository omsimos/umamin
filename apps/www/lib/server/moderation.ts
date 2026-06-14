import "server-only";

// Maintainer/moderator identity. Sourced from a server-only `MODERATOR_USERS`
// env (comma-separated usernames) — deliberately NOT the public
// NEXT_PUBLIC_VERIFIED_USERS list, so moderator power is decoupled from the
// verified badge and the roster never ships in a client bundle. The client only
// ever receives a per-session boolean (see getCurrentUserData), never the list.
// Swap this for a DB role column if per-user grants without a redeploy are ever
// needed — every call site already routes through this single helper.
const moderatorUsernames = new Set(
  (process.env.MODERATOR_USERS ?? "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean),
);

export function isModerator(
  user: { username: string } | null | undefined,
): boolean {
  if (!user?.username) return false;
  return moderatorUsernames.has(user.username);
}
