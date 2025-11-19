import { createHash } from "node:crypto";

const GRAVATAR_BASE_URL = "https://www.gravatar.com/avatar";
const GRAVATAR_SIZE = "256";
const GRAVATAR_RATING = "pg";
const GRAVATAR_DEFAULT = "mp";
const GRAVATAR_PREVIEW_DEFAULT = "404";

export function normaliseEmailForGravatar(email: string): string {
  return email.trim().toLowerCase();
}

export function hashEmailForGravatar(email: string): string {
  return createHash("md5").update(email).digest("hex");
}

export function buildGravatarUrl(hash: string, fallback: "mp" | "404" = "mp") {
  const params = new URLSearchParams({
    s: GRAVATAR_SIZE,
    r: GRAVATAR_RATING,
    d: fallback,
  });

  return `${GRAVATAR_BASE_URL}/${hash}?${params.toString()}`;
}

export function getGravatarPreviewUrl(hash: string) {
  return buildGravatarUrl(hash, GRAVATAR_PREVIEW_DEFAULT);
}

export function getGravatarFinalUrl(hash: string) {
  return buildGravatarUrl(hash, GRAVATAR_DEFAULT);
}
