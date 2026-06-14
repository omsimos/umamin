import { describe, expect, it } from "vitest";
import { parseSpotifyTrackId, spotifyEmbedUrl } from "./spotify";

const ID = "4cOdK2wGLETKBW3PvgPWqT"; // 22-char base62

describe("parseSpotifyTrackId", () => {
  it("accepts a plain track URL", () => {
    expect(parseSpotifyTrackId(`https://open.spotify.com/track/${ID}`)).toBe(
      ID,
    );
  });

  it("ignores the ?si= share query", () => {
    expect(
      parseSpotifyTrackId(`https://open.spotify.com/track/${ID}?si=abc123`),
    ).toBe(ID);
  });

  it("accepts an /intl-xx/ locale prefix", () => {
    expect(
      parseSpotifyTrackId(`https://open.spotify.com/intl-de/track/${ID}`),
    ).toBe(ID);
  });

  it("accepts a trailing slash", () => {
    expect(parseSpotifyTrackId(`https://open.spotify.com/track/${ID}/`)).toBe(
      ID,
    );
  });

  it("accepts the spotify:track: URI form", () => {
    expect(parseSpotifyTrackId(`spotify:track:${ID}`)).toBe(ID);
  });

  it("trims surrounding whitespace", () => {
    expect(
      parseSpotifyTrackId(`  https://open.spotify.com/track/${ID}  `),
    ).toBe(ID);
  });

  it("rejects albums, playlists, artists, and episodes (tracks only)", () => {
    expect(
      parseSpotifyTrackId(`https://open.spotify.com/album/${ID}`),
    ).toBeNull();
    expect(
      parseSpotifyTrackId(`https://open.spotify.com/playlist/${ID}`),
    ).toBeNull();
    expect(
      parseSpotifyTrackId(`https://open.spotify.com/artist/${ID}`),
    ).toBeNull();
    expect(parseSpotifyTrackId(`spotify:album:${ID}`)).toBeNull();
  });

  it("rejects look-alike and non-spotify hosts", () => {
    expect(
      parseSpotifyTrackId(`https://open.spotify.com.evil.com/track/${ID}`),
    ).toBeNull();
    expect(parseSpotifyTrackId(`https://evil.com/track/${ID}`)).toBeNull();
    expect(
      parseSpotifyTrackId(`http://open.spotify.com/track/${ID}`),
    ).toBeNull();
  });

  it("rejects ids of the wrong length and junk", () => {
    expect(
      parseSpotifyTrackId("https://open.spotify.com/track/tooShort"),
    ).toBeNull();
    expect(
      parseSpotifyTrackId(`https://open.spotify.com/track/${ID}extra`),
    ).toBeNull();
    expect(parseSpotifyTrackId("")).toBeNull();
    expect(parseSpotifyTrackId("not a url")).toBeNull();
    expect(parseSpotifyTrackId("javascript:alert(1)")).toBeNull();
  });
});

describe("spotifyEmbedUrl", () => {
  it("builds the canonical compact-embed URL", () => {
    expect(spotifyEmbedUrl(ID)).toBe(
      `https://open.spotify.com/embed/track/${ID}`,
    );
  });
});
