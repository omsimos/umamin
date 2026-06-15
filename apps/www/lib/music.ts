// Pure music-link parsing + embed-URL building for the supported platforms.
// No fetch, no secrets — safe to import from both client (composer validation,
// render) and server (the authoritative parse in createNoteAction). The platform
// is AUTO-DETECTED from the URL host; the user never picks one.
//
// Security: the stored `id` is a canonical, validated token (never a raw URL).
// Every embed/source URL is REBUILT from that token and re-validated here, so a
// tampered stored value can never inject an arbitrary iframe src.

export type MusicProvider = "spotify" | "apple" | "soundcloud" | "youtube";

export type MusicRef = {
  provider: MusicProvider;
  // Provider-specific canonical token:
  //  - spotify:    22-char track id
  //  - youtube:    11-char video id
  //  - soundcloud: "{user}/{track}" slug pair
  //  - apple:      "{storefront}/{albumId}" or "{storefront}/{albumId}/{songId}"
  id: string;
};

export type MusicAttachment = MusicRef & {
  title: string | null;
  thumbnail: string | null;
};

export const MUSIC_PROVIDER_LABEL: Record<MusicProvider, string> = {
  spotify: "Spotify",
  apple: "Apple Music",
  soundcloud: "SoundCloud",
  youtube: "YouTube Music",
};

// Cover art must live on the platform's own image CDN. Apple has no oEmbed, so
// it never produces a thumbnail.
const THUMBNAIL_HOST: Record<MusicProvider, (host: string) => boolean> = {
  spotify: (h) => h.endsWith(".scdn.co") || h.endsWith(".spotifycdn.com"),
  soundcloud: (h) => h === "sndcdn.com" || h.endsWith(".sndcdn.com"),
  youtube: (h) =>
    h === "i.ytimg.com" || h.endsWith(".ytimg.com") || h === "img.youtube.com",
  apple: () => false,
};

/**
 * Returns the thumbnail URL only if it's an https URL on the provider's own
 * image CDN, else null. Applied at write time (oEmbed) AND re-applied wherever a
 * STORED thumbnail is emitted/rendered, so a bad value in the column can never
 * become an <img src> — the same rebuild-and-revalidate invariant as the embed
 * URL.
 */
export function safeMusicThumbnail(
  provider: MusicProvider,
  value: unknown,
): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && THUMBNAIL_HOST[provider](url.hostname)
      ? value
      : null;
  } catch {
    return null;
  }
}

const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;
// Locale prefix can be multi-part (intl-de, intl-pt-br, intl-zh-hans).
const SPOTIFY_TRACK_PATH = /^\/(?:intl-[a-z-]+\/)?track\/([A-Za-z0-9]{22})\/?$/;
const SPOTIFY_TRACK_URI = /^spotify:track:([A-Za-z0-9]{22})$/;

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

const APPLE_STOREFRONT = /^[a-z]{2}$/;
const APPLE_NUMERIC_ID = /^\d+$/;
// /{storefront}/album/{slug}/{albumId} or /{storefront}/album/{albumId}
const APPLE_ALBUM_PATH = /^\/([a-z]{2})\/album\/(?:[^/]+\/)?(\d+)\/?$/;

const SC_SEGMENT = /^[a-z0-9][a-z0-9_-]*$/i;
// 2-segment paths whose second segment is a known non-track surface.
const SC_RESERVED_TRACK_SEGMENT = new Set([
  "sets",
  "likes",
  "tracks",
  "albums",
  "reposts",
  "comments",
  "followers",
  "following",
  "popular-tracks",
  "toptracks",
  "stats",
  "you",
]);

function parseSpotify(url: URL): MusicRef | null {
  if (url.hostname !== "open.spotify.com") return null;
  const m = url.pathname.match(SPOTIFY_TRACK_PATH);
  return m ? { provider: "spotify", id: m[1] } : null;
}

function parseApple(url: URL): MusicRef | null {
  if (url.hostname !== "music.apple.com") return null;
  const m = url.pathname.match(APPLE_ALBUM_PATH);
  if (!m) return null;
  const [, storefront, albumId] = m;
  const songId = url.searchParams.get("i");
  if (songId !== null && !APPLE_NUMERIC_ID.test(songId)) return null;
  return {
    provider: "apple",
    id: songId
      ? `${storefront}/${albumId}/${songId}`
      : `${storefront}/${albumId}`,
  };
}

function parseSoundcloud(url: URL): MusicRef | null {
  const host = url.hostname;
  // Short links resolve only via a server redirect we deliberately don't follow
  // (keeps parsing pure + no SSRF). The user pastes the full track URL instead.
  if (host !== "soundcloud.com" && host !== "m.soundcloud.com") return null;

  const segs = url.pathname.split("/").filter(Boolean);
  // A track is exactly /{user}/{track}; profiles are 1 segment, sets are 3+.
  if (segs.length !== 2) return null;
  const [user, track] = segs;
  if (!SC_SEGMENT.test(user) || !SC_SEGMENT.test(track)) return null;
  if (SC_RESERVED_TRACK_SEGMENT.has(track.toLowerCase())) return null;
  return { provider: "soundcloud", id: `${user}/${track}` };
}

function parseYoutube(url: URL): MusicRef | null {
  const host = url.hostname;
  let id: string | null = null;

  if (host === "youtu.be") {
    id = url.pathname.split("/").filter(Boolean)[0] ?? null;
  } else if (
    host === "music.youtube.com" ||
    host === "www.youtube.com" ||
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "www.youtube-nocookie.com"
  ) {
    if (url.pathname === "/watch" || url.pathname === "/watch/") {
      id = url.searchParams.get("v");
    } else {
      const m = url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/);
      if (m) id = m[1];
    }
  } else {
    return null;
  }

  return id && YT_ID.test(id) ? { provider: "youtube", id } : null;
}

/**
 * Auto-detects the platform from a pasted URL (or a Spotify URI) and returns the
 * canonical {provider, id}, or null if it isn't a supported single track/song/
 * video. Albums/playlists/artists/profiles and unsupported hosts are rejected.
 */
export function parseMusicUrl(input: string): MusicRef | null {
  const value = input.trim();
  if (!value) return null;

  const uri = value.match(SPOTIFY_TRACK_URI);
  if (uri) return { provider: "spotify", id: uri[1] };

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;

  return (
    parseSpotify(url) ??
    parseApple(url) ??
    parseSoundcloud(url) ??
    parseYoutube(url)
  );
}

/** The iframe `src` for a ref, rebuilt + re-validated. null if the token is bad. */
export function musicEmbedUrl(ref: MusicRef): string | null {
  switch (ref.provider) {
    case "spotify":
      return SPOTIFY_ID.test(ref.id)
        ? `https://open.spotify.com/embed/track/${ref.id}`
        : null;
    case "youtube":
      return YT_ID.test(ref.id)
        ? `https://www.youtube-nocookie.com/embed/${ref.id}`
        : null;
    case "soundcloud": {
      const [user, track, extra] = ref.id.split("/");
      if (extra !== undefined) return null;
      if (
        !user ||
        !track ||
        !SC_SEGMENT.test(user) ||
        !SC_SEGMENT.test(track)
      ) {
        return null;
      }
      const params = new URLSearchParams({
        url: `https://soundcloud.com/${user}/${track}`,
        color: "#ff5500",
        auto_play: "false",
        hide_related: "true",
        show_comments: "false",
        show_user: "true",
        show_reposts: "false",
        visual: "false",
      });
      return `https://w.soundcloud.com/player/?${params.toString()}`;
    }
    case "apple": {
      const [storefront, albumId, songId, extra] = ref.id.split("/");
      if (extra !== undefined) return null;
      if (
        !APPLE_STOREFRONT.test(storefront ?? "") ||
        !APPLE_NUMERIC_ID.test(albumId ?? "") ||
        (songId !== undefined && !APPLE_NUMERIC_ID.test(songId))
      ) {
        return null;
      }
      const base = `https://embed.music.apple.com/${storefront}/album/${albumId}`;
      return songId ? `${base}?i=${songId}` : base;
    }
  }
}

/**
 * The canonical public track URL for a ref — used only to build the (server-side)
 * oEmbed lookup from our own sanitized token, never reflected into an iframe.
 * null for Apple Music (no public oEmbed) and for malformed tokens.
 */
export function musicSourceUrl(ref: MusicRef): string | null {
  switch (ref.provider) {
    case "spotify":
      return SPOTIFY_ID.test(ref.id)
        ? `https://open.spotify.com/track/${ref.id}`
        : null;
    case "youtube":
      return YT_ID.test(ref.id)
        ? `https://www.youtube.com/watch?v=${ref.id}`
        : null;
    case "soundcloud": {
      const [user, track, extra] = ref.id.split("/");
      if (extra !== undefined || !user || !track) return null;
      if (!SC_SEGMENT.test(user) || !SC_SEGMENT.test(track)) return null;
      return `https://soundcloud.com/${user}/${track}`;
    }
    case "apple":
      return null;
  }
}
