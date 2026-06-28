import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AVATAR_MAX_BYTES,
  BANNER_MAX_BYTES,
  BANNER_TARGET_BYTES,
  hasImagePostingAura,
  imageExtension,
  isOwnStagingKey,
  MAX_AVATAR_SOURCE_BYTES,
  MAX_BANNER_SOURCE_BYTES,
  MAX_IMAGE_BYTES,
  MAX_POST_SOURCE_BYTES,
  MIN_AURA_FOR_IMAGES,
  postImageInputSchema,
  publicImageUrl,
  r2KeyFromPublicUrl,
} from "./post-images";

describe("upload byte caps", () => {
  it("keeps per-surface caps ordered: stored < picked, avatar < post", () => {
    expect(AVATAR_MAX_BYTES).toBeLessThan(MAX_AVATAR_SOURCE_BYTES);
    expect(MAX_IMAGE_BYTES).toBeLessThan(MAX_POST_SOURCE_BYTES);
    expect(MAX_AVATAR_SOURCE_BYTES).toBeLessThan(MAX_POST_SOURCE_BYTES);
  });

  it("keeps banner caps ordered: target < stored <= picked", () => {
    expect(BANNER_TARGET_BYTES).toBeLessThan(BANNER_MAX_BYTES);
    expect(BANNER_MAX_BYTES).toBeLessThanOrEqual(MAX_BANNER_SOURCE_BYTES);
    // Wider than an avatar, lighter than a post image.
    expect(BANNER_MAX_BYTES).toBeGreaterThan(AVATAR_MAX_BYTES);
    expect(BANNER_MAX_BYTES).toBeLessThan(MAX_IMAGE_BYTES);
  });
});

describe("isOwnStagingKey", () => {
  it("accepts the user's own staged key", () => {
    expect(isOwnStagingKey("staging/user_1/abc123.webp", "user_1")).toBe(true);
    expect(isOwnStagingKey("staging/user_1/abc123.jpg", "user_1")).toBe(true);
  });

  it("rejects another user's key", () => {
    expect(isOwnStagingKey("staging/user_2/abc123.webp", "user_1")).toBe(false);
  });

  it("rejects non-staging prefixes and traversal attempts", () => {
    expect(isOwnStagingKey("posts/user_1/abc123.webp", "user_1")).toBe(false);
    expect(isOwnStagingKey("staging/user_1/../other.webp", "user_1")).toBe(
      false,
    );
    expect(isOwnStagingKey("staging/user_1/a/b.webp", "user_1")).toBe(false);
    expect(isOwnStagingKey("staging/user_1/abc.png", "user_1")).toBe(false);
    expect(isOwnStagingKey("", "user_1")).toBe(false);
  });

  it("rejects a key whose user segment merely prefixes the id", () => {
    expect(isOwnStagingKey("staging/user_12/abc.webp", "user_1")).toBe(false);
  });
});

describe("hasImagePostingAura", () => {
  it("gates exactly at the threshold", () => {
    expect(hasImagePostingAura(MIN_AURA_FOR_IMAGES)).toBe(true);
    expect(hasImagePostingAura(MIN_AURA_FOR_IMAGES + 1)).toBe(true);
    expect(hasImagePostingAura(MIN_AURA_FOR_IMAGES - 1)).toBe(false);
  });

  it("treats zero and missing points as ineligible", () => {
    expect(hasImagePostingAura(0)).toBe(false);
    expect(hasImagePostingAura(null)).toBe(false);
    expect(hasImagePostingAura(undefined)).toBe(false);
  });
});

describe("imageExtension", () => {
  it("maps content types to extensions", () => {
    expect(imageExtension("image/webp")).toBe("webp");
    expect(imageExtension("image/jpeg")).toBe("jpg");
  });
});

describe("postImageInputSchema", () => {
  const valid = {
    key: "staging/user_1/abc.webp",
    width: 2048,
    height: 1536,
  };

  it("accepts a valid image input", () => {
    expect(postImageInputSchema.safeParse(valid).success).toBe(true);
  });

  it("bounds dimensions", () => {
    expect(postImageInputSchema.safeParse({ ...valid, width: 0 }).success).toBe(
      false,
    );
    expect(
      postImageInputSchema.safeParse({ ...valid, height: 9000 }).success,
    ).toBe(false);
    expect(
      postImageInputSchema.safeParse({ ...valid, width: 10.5 }).success,
    ).toBe(false);
  });
});

describe("publicImageUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("joins the public base with the key, normalizing slashes", () => {
    vi.stubEnv("NEXT_PUBLIC_R2_PUBLIC_URL", "https://media.example.com/");
    expect(publicImageUrl("posts/user_1/abc.webp")).toBe(
      "https://media.example.com/posts/user_1/abc.webp",
    );
  });

  it("returns empty when unconfigured", () => {
    vi.stubEnv("NEXT_PUBLIC_R2_PUBLIC_URL", "");
    expect(publicImageUrl("posts/user_1/abc.webp")).toBe("");
  });
});

describe("r2KeyFromPublicUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("extracts the key from our own public URL", () => {
    vi.stubEnv("NEXT_PUBLIC_R2_PUBLIC_URL", "https://media.example.com");
    expect(
      r2KeyFromPublicUrl("https://media.example.com/avatars/user_1/abc.webp"),
    ).toBe("avatars/user_1/abc.webp");
  });

  it("round-trips with publicImageUrl", () => {
    vi.stubEnv("NEXT_PUBLIC_R2_PUBLIC_URL", "https://media.example.com/");
    const key = "avatars/user_1/abc.webp";
    expect(r2KeyFromPublicUrl(publicImageUrl(key))).toBe(key);
  });

  it("returns null for foreign hosts, null input, and bare base", () => {
    vi.stubEnv("NEXT_PUBLIC_R2_PUBLIC_URL", "https://media.example.com");
    expect(
      r2KeyFromPublicUrl("https://lh3.googleusercontent.com/a/photo"),
    ).toBeNull();
    expect(r2KeyFromPublicUrl(null)).toBeNull();
    expect(r2KeyFromPublicUrl("https://media.example.com/")).toBeNull();
    // Prefix must match on a path boundary, not a hostname prefix.
    expect(
      r2KeyFromPublicUrl("https://media.example.com.evil.com/avatars/x.webp"),
    ).toBeNull();
  });

  it("returns null when unconfigured", () => {
    vi.stubEnv("NEXT_PUBLIC_R2_PUBLIC_URL", "");
    expect(
      r2KeyFromPublicUrl("https://media.example.com/avatars/u/a.webp"),
    ).toBeNull();
  });
});
