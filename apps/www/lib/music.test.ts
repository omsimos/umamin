import { describe, expect, it } from "vitest";
import {
  musicEmbedUrl,
  musicSourceUrl,
  parseMusicUrl,
  safeMusicThumbnail,
} from "./music";

const SPOTIFY_ID = "4cOdK2wGLETKBW3PvgPWqT";
const VIDEO_ID = "dQw4w9WgXcQ";

describe("parseMusicUrl — Spotify", () => {
  it("parses track URL/URI variants (query, locale, trailing slash)", () => {
    expect(
      parseMusicUrl(`https://open.spotify.com/track/${SPOTIFY_ID}`),
    ).toEqual({ provider: "spotify", id: SPOTIFY_ID });
    expect(
      parseMusicUrl(`https://open.spotify.com/track/${SPOTIFY_ID}?si=abc123`),
    ).toEqual({ provider: "spotify", id: SPOTIFY_ID });
    expect(
      parseMusicUrl(`https://open.spotify.com/intl-de/track/${SPOTIFY_ID}`),
    ).toEqual({ provider: "spotify", id: SPOTIFY_ID });
    // Multi-part locale prefixes (intl-pt-br, intl-zh-hans) must be accepted.
    expect(
      parseMusicUrl(`https://open.spotify.com/intl-pt-br/track/${SPOTIFY_ID}`),
    ).toEqual({ provider: "spotify", id: SPOTIFY_ID });
    expect(parseMusicUrl(`spotify:track:${SPOTIFY_ID}`)).toEqual({
      provider: "spotify",
      id: SPOTIFY_ID,
    });
  });

  it("rejects albums/playlists, look-alike hosts, and http", () => {
    expect(
      parseMusicUrl(`https://open.spotify.com/album/${SPOTIFY_ID}`),
    ).toBeNull();
    expect(
      parseMusicUrl(`https://open.spotify.com.evil.com/track/${SPOTIFY_ID}`),
    ).toBeNull();
    expect(
      parseMusicUrl(`http://open.spotify.com/track/${SPOTIFY_ID}`),
    ).toBeNull();
  });
});

describe("parseMusicUrl — Apple Music", () => {
  it("parses a song (album URL + ?i=) and a plain album", () => {
    expect(
      parseMusicUrl(
        "https://music.apple.com/us/album/let-it-be/1441164359?i=1441164376",
      ),
    ).toEqual({ provider: "apple", id: "us/1441164359/1441164376" });
    expect(
      parseMusicUrl("https://music.apple.com/gb/album/let-it-be/1441164359"),
    ).toEqual({ provider: "apple", id: "gb/1441164359" });
  });

  it("tolerates an arbitrary or absent slug (only ids are load-bearing)", () => {
    expect(
      parseMusicUrl("https://music.apple.com/us/album/1441164359?i=1441164376"),
    ).toEqual({ provider: "apple", id: "us/1441164359/1441164376" });
  });

  it("rejects playlists and non-numeric ids", () => {
    expect(
      parseMusicUrl("https://music.apple.com/us/playlist/x/pl.abc123"),
    ).toBeNull();
    expect(
      parseMusicUrl("https://music.apple.com/us/album/let-it-be/nope"),
    ).toBeNull();
  });
});

describe("parseMusicUrl — SoundCloud", () => {
  it("parses a track slug URL (and the m. host)", () => {
    expect(parseMusicUrl("https://soundcloud.com/forss/flickermood")).toEqual({
      provider: "soundcloud",
      id: "forss/flickermood",
    });
    expect(parseMusicUrl("https://m.soundcloud.com/forss/flickermood")).toEqual(
      {
        provider: "soundcloud",
        id: "forss/flickermood",
      },
    );
  });

  it("rejects sets, profiles, reserved segments, and short links", () => {
    expect(parseMusicUrl("https://soundcloud.com/forss/sets/album")).toBeNull();
    expect(parseMusicUrl("https://soundcloud.com/forss")).toBeNull();
    expect(parseMusicUrl("https://soundcloud.com/forss/likes")).toBeNull();
    expect(parseMusicUrl("https://on.soundcloud.com/abc123")).toBeNull();
    expect(parseMusicUrl("https://snd.sc/abc123")).toBeNull();
  });
});

describe("parseMusicUrl — YouTube", () => {
  it("parses watch / music / youtu.be / m. URLs and drops list=", () => {
    expect(
      parseMusicUrl(`https://music.youtube.com/watch?v=${VIDEO_ID}`),
    ).toEqual({ provider: "youtube", id: VIDEO_ID });
    expect(
      parseMusicUrl(
        `https://www.youtube.com/watch?v=${VIDEO_ID}&list=OLAK5uy_x`,
      ),
    ).toEqual({ provider: "youtube", id: VIDEO_ID });
    expect(parseMusicUrl(`https://youtu.be/${VIDEO_ID}`)).toEqual({
      provider: "youtube",
      id: VIDEO_ID,
    });
    expect(parseMusicUrl(`https://m.youtube.com/watch?v=${VIDEO_ID}`)).toEqual({
      provider: "youtube",
      id: VIDEO_ID,
    });
    // Tolerate a trailing slash on /watch.
    expect(
      parseMusicUrl(`https://www.youtube.com/watch/?v=${VIDEO_ID}`),
    ).toEqual({ provider: "youtube", id: VIDEO_ID });
  });

  it("rejects a playlist-only URL and a malformed id", () => {
    expect(
      parseMusicUrl("https://www.youtube.com/playlist?list=PLx"),
    ).toBeNull();
    expect(parseMusicUrl("https://youtu.be/short")).toBeNull();
  });
});

describe("parseMusicUrl — misc", () => {
  it("rejects empty, non-url, and unsupported hosts", () => {
    expect(parseMusicUrl("")).toBeNull();
    expect(parseMusicUrl("not a url")).toBeNull();
    expect(parseMusicUrl("javascript:alert(1)")).toBeNull();
    expect(parseMusicUrl("https://example.com/song")).toBeNull();
  });
});

describe("musicEmbedUrl", () => {
  it("builds the per-provider iframe src", () => {
    expect(musicEmbedUrl({ provider: "spotify", id: SPOTIFY_ID })).toBe(
      `https://open.spotify.com/embed/track/${SPOTIFY_ID}`,
    );
    expect(musicEmbedUrl({ provider: "youtube", id: VIDEO_ID })).toBe(
      `https://www.youtube-nocookie.com/embed/${VIDEO_ID}`,
    );
    expect(
      musicEmbedUrl({ provider: "apple", id: "us/1441164359/1441164376" }),
    ).toBe("https://embed.music.apple.com/us/album/1441164359?i=1441164376");
    expect(musicEmbedUrl({ provider: "apple", id: "us/1441164359" })).toBe(
      "https://embed.music.apple.com/us/album/1441164359",
    );

    const sc = musicEmbedUrl({
      provider: "soundcloud",
      id: "forss/flickermood",
    });
    expect(sc).toContain("https://w.soundcloud.com/player/?");
    expect(sc).toContain(
      "url=https%3A%2F%2Fsoundcloud.com%2Fforss%2Fflickermood",
    );
  });

  it("returns null for a tampered/invalid stored token", () => {
    expect(musicEmbedUrl({ provider: "spotify", id: "tooShort" })).toBeNull();
    expect(musicEmbedUrl({ provider: "youtube", id: "../../etc" })).toBeNull();
    expect(
      musicEmbedUrl({ provider: "apple", id: "us/notanumber" }),
    ).toBeNull();
    expect(musicEmbedUrl({ provider: "soundcloud", id: "a/b/c" })).toBeNull();
  });
});

describe("safeMusicThumbnail", () => {
  it("allows only the provider's own image CDN over https", () => {
    expect(safeMusicThumbnail("spotify", "https://i.scdn.co/image/abc")).toBe(
      "https://i.scdn.co/image/abc",
    );
    expect(
      safeMusicThumbnail("soundcloud", "https://i1.sndcdn.com/x-large.jpg"),
    ).toBe("https://i1.sndcdn.com/x-large.jpg");
    expect(
      safeMusicThumbnail("youtube", "https://i.ytimg.com/vi/x/hq.jpg"),
    ).toBe("https://i.ytimg.com/vi/x/hq.jpg");
  });

  it("rejects foreign hosts, http, apple, and non-strings", () => {
    expect(safeMusicThumbnail("spotify", "https://evil.com/x.jpg")).toBeNull();
    expect(safeMusicThumbnail("spotify", "http://i.scdn.co/x.jpg")).toBeNull();
    // a scdn URL must not pass under a different provider
    expect(
      safeMusicThumbnail("soundcloud", "https://i.scdn.co/image/abc"),
    ).toBeNull();
    expect(
      safeMusicThumbnail("apple", "https://i.scdn.co/image/abc"),
    ).toBeNull();
    expect(safeMusicThumbnail("spotify", null)).toBeNull();
    expect(safeMusicThumbnail("spotify", 42)).toBeNull();
  });
});

describe("musicSourceUrl", () => {
  it("builds the oEmbed source URL (null for Apple — no oEmbed)", () => {
    expect(musicSourceUrl({ provider: "spotify", id: SPOTIFY_ID })).toBe(
      `https://open.spotify.com/track/${SPOTIFY_ID}`,
    );
    expect(musicSourceUrl({ provider: "youtube", id: VIDEO_ID })).toBe(
      `https://www.youtube.com/watch?v=${VIDEO_ID}`,
    );
    expect(
      musicSourceUrl({ provider: "soundcloud", id: "forss/flickermood" }),
    ).toBe("https://soundcloud.com/forss/flickermood");
    expect(
      musicSourceUrl({ provider: "apple", id: "us/1441164359" }),
    ).toBeNull();
  });
});
