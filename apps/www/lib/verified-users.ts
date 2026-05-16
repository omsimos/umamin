const VERIFIED = new Set(
  (process.env.NEXT_PUBLIC_VERIFIED_USERS ?? "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean),
);

export function isVerifiedUser(username?: string | null): boolean {
  return !!username && VERIFIED.has(username);
}
