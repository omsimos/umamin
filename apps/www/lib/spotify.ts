// Pure Spotify track-link parsing + embed URL building. No fetch, no secrets —
// safe to import from both client (composer validation, render) and server
// (the authoritative parse in createNoteAction).

// Spotify ids are 22-char base62.
const TRACK_URL_PATH = /^\/(?:intl-[a-z]{2}\/)?track\/([A-Za-z0-9]{22})\/?$/;
const TRACK_URI = /^spotify:track:([A-Za-z0-9]{22})$/;

/**
 * Extracts a Spotify TRACK id from a share URL or URI, or null if the input is
 * not a track. Accepts:
 *  - https://open.spotify.com/track/{id}   (also ?si=… queries and an /intl-xx/ locale prefix)
 *  - spotify:track:{id}
 * Albums/playlists/artists/episodes are deliberately rejected (tracks-only v1).
 */
export function parseSpotifyTrackId(input: string): string | null {
  const value = input.trim();
  if (!value) return null;

  const uri = value.match(TRACK_URI);
  if (uri) return uri[1];

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" || url.hostname !== "open.spotify.com") {
    return null;
  }

  const match = url.pathname.match(TRACK_URL_PATH);
  return match ? match[1] : null;
}

export function spotifyEmbedUrl(trackId: string): string {
  return `https://open.spotify.com/embed/track/${trackId}`;
}

export function spotifyTrackUrl(trackId: string): string {
  return `https://open.spotify.com/track/${trackId}`;
}
