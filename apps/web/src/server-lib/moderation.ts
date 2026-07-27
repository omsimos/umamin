// Maintainer/moderator identity. Sourced from a server-only `MODERATOR_USERS`
// secret (comma-separated usernames) — deliberately NOT the public verified
// list, so moderator power is decoupled from the verified badge and the roster
// never ships in a client bundle. The client only ever receives a per-session
// boolean (see getCurrentUserData), never the list.
//
// Ported from apps/www with the module-init `process.env` read removed: the
// roster string is passed in explicitly (from `env.MODERATOR_USERS` at the call
// site) so this stays a pure function with no ambient env dependency — the
// Workers "explicit deps" rule. Swap for a DB role column if per-user grants
// without a redeploy are ever needed; every call site routes through here.

export function parseModerators(raw: string | null | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((u) => u.trim())
      .filter(Boolean),
  );
}

export function isModerator(
  user: { username: string } | null | undefined,
  moderatorUsers: string | null | undefined,
): boolean {
  if (!user?.username) return false;
  return parseModerators(moderatorUsers).has(user.username);
}
