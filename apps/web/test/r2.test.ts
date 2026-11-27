import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AVATAR_MAX_BYTES, isOwnStagingKey } from "../src/lib/post-images";
import type { AppEnv } from "../src/server-lib/env";
import { createR2, newStagingKey } from "../src/server-lib/r2";

const wellFormed = {
  R2_ACCOUNT_ID: "a".repeat(32),
  R2_ACCESS_KEY_ID: "b".repeat(32),
  R2_SECRET_ACCESS_KEY: "c".repeat(64),
  R2_BUCKET: "umamin",
  R2_PUBLIC_URL: "https://cdn.example.com",
};

const env = (overrides: Partial<AppEnv> = {}) =>
  ({ ...wellFormed, ...overrides }) as unknown as AppEnv;

describe("createR2", () => {
  it("builds a client when the credentials are well formed", () => {
    expect(createR2(env())).not.toBeNull();
  });

  it("returns null when R2 config is absent", () => {
    expect(createR2(env({ R2_BUCKET: undefined }))).toBeNull();
  });

  it("rejects a swapped access-key/secret pair", () => {
    expect(
      createR2(
        env({
          R2_ACCESS_KEY_ID: wellFormed.R2_SECRET_ACCESS_KEY,
          R2_SECRET_ACCESS_KEY: wellFormed.R2_ACCESS_KEY_ID,
        }),
      ),
    ).toBeNull();
  });
});

const JPEG_MAGIC = new Uint8Array(16);
JPEG_MAGIC.set([0xff, 0xd8, 0xff]);

function rangedHead(bytes: Uint8Array<ArrayBuffer>, total: number) {
  return new Response(bytes, {
    status: 206,
    headers: { "content-range": `bytes 0-15/${total}` },
  });
}

describe("isOwnStagingKey", () => {
  it.each(["staging/u1/abc.jpg", "staging/u1/abc.webp"])(
    "accepts the caller's own key %s",
    (key) => {
      expect(isOwnStagingKey(key, "u1")).toBe(true);
    },
  );

  it.each([
    "staging/u2/abc.jpg",
    "staging/u1x/abc.jpg",
    "staging/u1/../u2/abc.jpg",
    "staging/u1/abc.png",
    "posts/u1/abc.jpg",
    "staging/u1/sub/abc.jpg",
  ])("rejects %s", (key) => {
    expect(isOwnStagingKey(key, "u1")).toBe(false);
  });

  it("agrees with the key generator", () => {
    expect(isOwnStagingKey(newStagingKey("u1", "image/webp"), "u1")).toBe(true);
    expect(isOwnStagingKey(newStagingKey("u1", "image/jpeg"), "u2")).toBe(
      false,
    );
  });
});

describe("presignImagePut", () => {
  it("signs the content length and type, not just the key", async () => {
    const r2 = createR2(env());
    const url = new URL(
      (await r2?.presignImagePut({
        key: "staging/u1/abc.jpg",
        contentType: "image/jpeg",
        contentLength: 1234,
      })) ?? "",
    );

    const signed = url.searchParams.get("X-Amz-SignedHeaders")?.split(";");
    expect(signed).toContain("content-length");
    expect(signed).toContain("content-type");
    expect(url.pathname.endsWith("/umamin/staging/u1/abc.jpg")).toBe(true);
  });
});

describe("claimStagedAvatar", () => {
  const fetchMock = vi.fn<(req: Request) => Promise<Response>>();
  const requests = () => fetchMock.mock.calls.map(([req]) => req);

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects another user's key without touching R2", async () => {
    const r2 = createR2(env());

    expect(await r2?.claimStagedAvatar("u1", "staging/u2/abc.jpg")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an object whose bytes aren't a jpeg or webp", async () => {
    fetchMock.mockResolvedValue(rangedHead(new Uint8Array(16), 5000));
    const r2 = createR2(env());

    expect(await r2?.claimStagedAvatar("u1", "staging/u1/abc.jpg")).toBeNull();
    expect(requests().some((req) => req.method === "PUT")).toBe(false);
  });

  it("rejects an object larger than the avatar limit", async () => {
    fetchMock.mockResolvedValue(rangedHead(JPEG_MAGIC, AVATAR_MAX_BYTES + 1));
    const r2 = createR2(env());

    expect(await r2?.claimStagedAvatar("u1", "staging/u1/abc.jpg")).toBeNull();
    expect(requests().some((req) => req.method === "PUT")).toBe(false);
  });

  it("copies a valid object under the caller's own prefix", async () => {
    fetchMock.mockImplementation(async (req) => {
      if (req.method === "PUT") return new Response(null, { status: 200 });
      if (req.method === "DELETE") return new Response(null, { status: 204 });
      return rangedHead(JPEG_MAGIC, 5000);
    });
    const r2 = createR2(env());

    const key = await r2?.claimStagedAvatar("u1", "staging/u1/abc.jpg");

    expect(key).toMatch(/^avatars\/u1\/[A-Za-z0-9_-]+\.jpg$/);
    const put = requests().find((req) => req.method === "PUT");
    expect(put?.headers.get("x-amz-copy-source")).toBe(
      "/umamin/staging/u1/abc.jpg",
    );
  });
});

describe("claimStagedImages", () => {
  const fetchMock = vi.fn<(req: Request) => Promise<Response>>();
  const requests = () => fetchMock.mock.calls.map(([req]) => req);
  const images = [
    { key: "staging/u1/a.jpg", width: 10, height: 10 },
    { key: "staging/u1/b.jpg", width: 10, height: 10 },
  ];

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    // Zero backoff so a retry loop costs no wall time in the test.
    vi.spyOn(Math, "random").mockReturnValue(0);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // Each retry adds exponential backoff; ten of them held a post save for
  // close to a minute while R2 returned errors.
  it("gives up on an R2 error after one retry", async () => {
    fetchMock.mockImplementation(
      async () => new Response(null, { status: 503 }),
    );
    const r2 = createR2(env());

    expect(await r2?.claimStagedImages("u1", images.slice(0, 1))).toBeNull();
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it("removes copied images when another image's copy throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockImplementation(async (req) => {
      if (req.method === "PUT") {
        if (req.headers.get("x-amz-copy-source")?.endsWith("/b.jpg")) {
          throw new TypeError("network connection lost");
        }
        return new Response(null, { status: 200 });
      }
      if (req.method === "DELETE") return new Response(null, { status: 204 });
      return rangedHead(JPEG_MAGIC, 5000);
    });
    const r2 = createR2(env());

    expect(await r2?.claimStagedImages("u1", images)).toBeNull();

    const copied = requests().find(
      (req) =>
        req.method === "PUT" &&
        req.headers.get("x-amz-copy-source")?.endsWith("/a.jpg"),
    );
    expect(copied).toBeDefined();
    const deleted = requests()
      .filter((req) => req.method === "DELETE")
      .map((req) => req.url);
    expect(deleted).toContain(copied?.url);
  });
});
