import * as z from "zod";

// One photo per post for now; the schema/grid/lightbox all handle arrays, so
// raising this later is a one-line change.
export const MAX_POST_IMAGES = 1;

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

// Caps on the *picked* file, pre-compression (platform-conventional: 5MB
// photos, 2MB profile photos). These never reach our servers — they bound
// client decode memory and reject absurd files fast; what's stored is the
// compressed result above.
export const MAX_POST_SOURCE_BYTES = 5 * 1024 * 1024;
export const MAX_AVATAR_SOURCE_BYTES = 2 * 1024 * 1024;

// WebP everywhere it can be encoded; JPEG is the Safari fallback (no canvas
// WebP *encode* support in any Safari as of 2026 — decode is fine).
export const UPLOAD_CONTENT_TYPES = ["image/webp", "image/jpeg"] as const;
export type UploadContentType = (typeof UPLOAD_CONTENT_TYPES)[number];

export const PLUS_REQUIRED_ERROR =
  "Image uploads are an Umamin+ perk — unlocked once your account is a year old.";

export function imageExtension(contentType: UploadContentType) {
  return contentType === "image/webp" ? "webp" : "jpg";
}

// Uploads land under staging/ first; createPostAction claims them by copying
// to posts/. An R2 lifecycle rule expires staging/* after a day, so abandoned
// composer uploads clean themselves up without a cron or a tracking table.
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

// Build-time inlined for the client bundle; the whole feature is hidden when
// the serving domain isn't configured.
export function postImagesEnabled() {
  return Boolean(process.env.NEXT_PUBLIC_R2_PUBLIC_URL);
}

export function publicImageUrl(key: string) {
  const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  if (!base) return "";
  return `${base.replace(/\/+$/, "")}/${key}`;
}

// Inverse of publicImageUrl — identifies our own R2 objects (e.g. an old
// avatar to delete on replacement). Returns null for any other host.
export function r2KeyFromPublicUrl(url: string | null | undefined) {
  const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  if (!base || !url) return null;

  const prefix = `${base.replace(/\/+$/, "")}/`;
  if (!url.startsWith(prefix)) return null;

  const key = url.slice(prefix.length);
  return key.length > 0 ? key : null;
}
