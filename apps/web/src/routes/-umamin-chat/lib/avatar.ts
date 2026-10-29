import { blobatarUri } from "blobatar/uri";

/** Deterministic per-seed blobatar as an SVG data: URI — the single source of
 *  truth for chat avatars, shared by <SeedAvatar> and the share cards. Same
 *  creature style as profile pictures elsewhere, but seeded on the session's
 *  random avatar seed, never a user id, so it can't link a chat to an account. */
export function avatarDataUri(seed: string): string {
  return blobatarUri(seed);
}
