import "server-only";

import { type MusicRef, musicSourceUrl, safeMusicThumbnail } from "@/lib/music";

export type MusicMeta = {
  title: string | null;
  thumbnail: string | null;
};

const EMPTY: MusicMeta = { title: null, thumbnail: null };

// Provider oEmbed endpoints (no auth, no key). Apple Music has no working public
// oEmbed in 2026, so it's intentionally absent — its embed renders bare.
const OEMBED_ENDPOINT: Partial<Record<MusicRef["provider"], string>> = {
  spotify: "https://open.spotify.com/oembed",
  soundcloud: "https://soundcloud.com/oembed",
  youtube: "https://www.youtube.com/oembed",
};

/**
 * Best-effort title + cover art for an ALREADY-VALIDATED ref via the platform's
 * public oEmbed endpoint. The oEmbed URL is built from our own sanitized token
 * (musicSourceUrl) — never raw user input — so there is no SSRF surface. Any
 * failure (no endpoint, timeout, non-200, bad shape) returns empty metadata; the
 * stored id alone is enough for the embed to render the full player after a tap.
 */
export async function fetchMusicMeta(ref: MusicRef): Promise<MusicMeta> {
  const endpoint = OEMBED_ENDPOINT[ref.provider];
  const source = musicSourceUrl(ref);
  if (!endpoint || !source) return EMPTY;

  try {
    const oembed = new URL(endpoint);
    oembed.searchParams.set("url", source);
    oembed.searchParams.set("format", "json");
    if (ref.provider === "soundcloud") {
      // Compact card height (oEmbed otherwise returns the tall visual player).
      oembed.searchParams.set("maxheight", "166");
    }

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
      thumbnail: safeMusicThumbnail(ref.provider, data.thumbnail_url),
    };
  } catch {
    return EMPTY;
  }
}
