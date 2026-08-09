import * as z from "zod";
import { hasUmaminPro } from "./pro";

// Pure image-upload constants + helpers, ported from apps/www/lib/post-images.ts.
// The URL helpers that read the R2 public base now take it as an explicit
// argument instead of `process.env.NEXT_PUBLIC_R2_PUBLIC_URL` (no ambient env):
// the server passes `env.R2_PUBLIC_URL`, the client its build-time value.

export const MAX_POST_IMAGES = 4;

// Aggressive lossy target the client compresses toward. The server caps the
// *declared* upload size with headroom for noisy photos that resist
// compression; the presigned PUT pins that exact byte count.
export const TARGET_IMAGE_BYTES = 300 * 1024;
export const MAX_IMAGE_BYTES = 1024 * 1024;
// Long-edge cap: the feed column maxes at ~576 CSS px, so 768 stays sharp at
// standard density (acceptably soft on retina) while keeping bytes minimal.
export const MAX_IMAGE_EDGE = 768;

// Profile photos: square-cropped, rendered at <=64px CSS (~160px retina on
// the profile page) — 256px covers every surface, and the byte budget is a
// fraction of a post image's.
export const AVATAR_EDGE = 256;
export const AVATAR_TARGET_BYTES = 48 * 1024;
export const AVATAR_MAX_BYTES = 256 * 1024;

// Profile banners: 3:1 cover, stored at the long edge below — the profile
// column maxes at ~576 CSS px, so 1200 stays sharp on retina.
export const BANNER_ASPECT = 3;
export const BANNER_EDGE = 1200;
export const BANNER_TARGET_BYTES = 150 * 1024;
export const BANNER_MAX_BYTES = 400 * 1024;

// Caps on the *picked* file, pre-compression (platform-conventional: 5MB
// photos, 2MB profile photos). These never reach our servers — they bound
// client decode memory and reject absurd files fast; what's stored is the
// compressed result above.
export const MAX_POST_SOURCE_BYTES = 5 * 1024 * 1024;
export const MAX_AVATAR_SOURCE_BYTES = 2 * 1024 * 1024;
export const MAX_BANNER_SOURCE_BYTES = 5 * 1024 * 1024;

// WebP everywhere it can be encoded; JPEG is the Safari fallback (no canvas
// WebP *encode* support in any Safari as of 2026 — decode is fine).
export const UPLOAD_CONTENT_TYPES = ["image/webp", "image/jpeg"] as const;
export type UploadContentType = (typeof UPLOAD_CONTENT_TYPES)[number];

// Posting images requires a minimum Aura score — a low engagement bar that
// keeps zero-history throwaway accounts out. Aura is earned only from OTHER
// users' engagement (see server-lib/points.ts), and that path has its own
// account-age guard, so it can't be self-farmed.
export const MIN_AURA_FOR_IMAGES = 50;

export const IMAGE_AURA_REQUIRED_ERROR = `Posting images unlocks at ${MIN_AURA_FOR_IMAGES} aura — keep engaging to get there, or get it now with Umamin Pro.`;

export function hasImagePostingAura(points: number | null | undefined) {
  return (points ?? 0) >= MIN_AURA_FOR_IMAGES;
}

/**
 * Whether a user may attach images: the aura bar, OR an active Umamin Pro —
 * a paid account is not the zero-history throwaway the bar exists to stop.
 * Deriving from proUntil at render time means the client gate re-locks on
 * expiry; the upload + create mutations re-check this same helper server-side.
 */
export function canPostImages(
  user?: {
    points?: number | null;
    proUntil?: Date | string | null;
  } | null,
) {
  return hasImagePostingAura(user?.points) || hasUmaminPro(user?.proUntil);
}

export function imageExtension(contentType: UploadContentType) {
  return contentType === "image/webp" ? "webp" : "jpg";
}

// Uploads land under staging/ first; the create-post action claims them by
// copying to posts/. An R2 lifecycle rule expires staging/* after a day, so
// abandoned composer uploads clean themselves up without a cron or table.
const STAGING_KEY_PATTERN =
  /^staging\/([A-Za-z0-9_-]+)\/[A-Za-z0-9_-]+\.(webp|jpg)$/;

export function isOwnStagingKey(key: string, userId: string) {
  const match = STAGING_KEY_PATTERN.exec(key);
  return match !== null && match[1] === userId;
}

export const postImageInputSchema = z.object({
  key: z.string().min(1).max(200),
  width: z.number().int().min(1).max(8192),
  height: z.number().int().min(1).max(8192),
});

export type PostImageInput = z.infer<typeof postImageInputSchema>;

export function postImagesEnabled(publicBase: string | null | undefined) {
  return Boolean(publicBase);
}

export function publicImageUrl(
  publicBase: string | null | undefined,
  key: string,
) {
  if (!publicBase) return "";
  return `${publicBase.replace(/\/+$/, "")}/${key}`;
}

// Build-time R2 public base for the browser bundle. Server callers pass
// `env.R2_PUBLIC_URL` explicitly; client components read it from the inlined
// Vite env so they don't have to thread the base through every render.
export const CLIENT_R2_PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL ?? null;

// Client convenience over publicImageUrl bound to the build-time base.
export function clientImageUrl(key: string) {
  return publicImageUrl(CLIENT_R2_PUBLIC_URL, key);
}

// Inverse of publicImageUrl — identifies our own R2 objects (e.g. an old
// avatar to delete on replacement). Returns null for any other host.
export function r2KeyFromPublicUrl(
  publicBase: string | null | undefined,
  url: string | null | undefined,
) {
  if (!publicBase || !url) return null;

  const prefix = `${publicBase.replace(/\/+$/, "")}/`;
  if (!url.startsWith(prefix)) return null;

  const key = url.slice(prefix.length);
  return key.length > 0 ? key : null;
}
