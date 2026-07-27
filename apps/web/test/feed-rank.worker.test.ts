import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import {
  getRedisHotPostIdsPage,
  isRedisHotCursor,
} from "../src/server-lib/feed-rank";

// The ranked-id list now lives in a single Workers KV key (was a Redis zset).
// These exercise the `rh.<offset>` paging contract against real miniflare KV.
const HOT_FEED_KEY = "feed:hot:v2";
const kv = (env as { KV: KVNamespace }).KV;

async function seedRanked(count: number) {
  const ids = Array.from({ length: count }, (_, i) => `p${i}`);
  await kv.put(HOT_FEED_KEY, JSON.stringify(ids));
  return ids;
}

describe("isRedisHotCursor", () => {
  it("is true only for `rh.`-prefixed strings", () => {
    expect(isRedisHotCursor("rh.0")).toBe(true);
    expect(isRedisHotCursor("rh.40")).toBe(true);
    expect(isRedisHotCursor("rh.")).toBe(true);
    expect(isRedisHotCursor(null)).toBe(false);
    expect(isRedisHotCursor(undefined)).toBe(false);
    expect(isRedisHotCursor("")).toBe(false);
    expect(isRedisHotCursor("40")).toBe(false);
    expect(isRedisHotCursor("x.rh.0")).toBe(false);
  });
});

describe("getRedisHotPostIdsPage (miniflare KV)", () => {
  beforeEach(async () => {
    await kv.delete(HOT_FEED_KEY);
  });

  it("returns null when KV is unbound", async () => {
    expect(await getRedisHotPostIdsPage(undefined, null, 20, 10)).toBeNull();
  });

  it("returns null when the key is empty (→ DB fallback)", async () => {
    expect(await getRedisHotPostIdsPage(kv, null, 20, 10)).toBeNull();
  });

  it("returns null when ranked items are below minRankedItems", async () => {
    await seedRanked(5);
    expect(await getRedisHotPostIdsPage(kv, null, 20, 10)).toBeNull();
  });

  it("returns a full page + nextCursor when an extra id is peeked", async () => {
    const ids = await seedRanked(100);
    const result = await getRedisHotPostIdsPage(kv, null, 20, 10);
    expect(result?.ids).toHaveLength(20);
    expect(result?.ids).toEqual(ids.slice(0, 20));
    expect(result?.nextCursor).toBe("rh.20");
  });

  it("parses a valid offset cursor into the window", async () => {
    const ids = await seedRanked(100);
    const result = await getRedisHotPostIdsPage(kv, "rh.40", 20, 10);
    expect(result?.ids).toEqual(ids.slice(40, 60));
    expect(result?.nextCursor).toBe("rh.60");
  });

  it("returns nextCursor=null on the last exact page", async () => {
    await seedRanked(20);
    const result = await getRedisHotPostIdsPage(kv, null, 20, 10);
    expect(result?.ids).toHaveLength(20);
    expect(result?.nextCursor).toBeNull();
  });

  it("returns null when fewer than pageSize ids remain", async () => {
    await seedRanked(15);
    expect(await getRedisHotPostIdsPage(kv, null, 20, 10)).toBeNull();
  });

  it("returns null when the offset is past the end", async () => {
    await seedRanked(100);
    expect(await getRedisHotPostIdsPage(kv, "rh.100", 20, 10)).toBeNull();
  });

  it("treats an invalid/negative cursor offset as 0", async () => {
    const ids = await seedRanked(100);
    const invalid = await getRedisHotPostIdsPage(kv, "rh.notanumber", 20, 10);
    expect(invalid?.ids).toEqual(ids.slice(0, 20));
    const negative = await getRedisHotPostIdsPage(kv, "rh.-5", 20, 10);
    expect(negative?.ids).toEqual(ids.slice(0, 20));
  });
});
