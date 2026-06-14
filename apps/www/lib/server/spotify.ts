import "server-only";

import { spotifyTrackUrl } from "@/lib/spotify";

export type SpotifyTrackMeta = {
  title: string | null;
  thumbnail: string | null;
};

const EMPTY: SpotifyTrackMeta = { title: null, thumbnail: null };

// Cover art always lives on Spotify's own image CDNs; anything else is rejected
// so a malformed/compromised oEmbed response can never make us render or store
// an arbitrary <img src>.
function isSpotifyImage(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname.endsWith(".scdn.co") ||
        url.hostname.endsWith(".spotifycdn.com"))
    );
  } catch {
    return false;
  }
}

/**
 * Best-effort title + cover art for an ALREADY-VALIDATED track id via Spotify's
 * public oEmbed endpoint (no auth, no key). The oEmbed URL is built from our own
 * sanitized id — never raw user input — so there is no SSRF surface. Any failure
 * (timeout, non-200, bad shape) returns empty metadata; the stored id alone is
 * enough for the embed to render the full song after a tap.
 */
export async function fetchSpotifyTrackMeta(
  trackId: string,
): Promise<SpotifyTrackMeta> {
  try {
    const oembed = new URL("https://open.spotify.com/oembed");
    oembed.searchParams.set("url", spotifyTrackUrl(trackId));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(oembed, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) return EMPTY;

    const data = (await res.json()) as {
      title?: unknown;
      thumbnail_url?: unknown;
    };

    return {
      title:
        typeof data.title === "string" ? data.title.slice(0, 200).trim() : null,
      thumbnail: isSpotifyImage(data.thumbnail_url) ? data.thumbnail_url : null,
    };
  } catch {
    return EMPTY;
  }
}
