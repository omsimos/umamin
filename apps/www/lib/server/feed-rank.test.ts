import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@umamin/db", () => ({ db: { select: vi.fn() } }));

// Hoisted so the `vi.mock` factory (also hoisted) can reference it.
const redisMock = vi.hoisted(() => ({
  zcard: vi.fn(),
  zrange: vi.fn(),
  zadd: vi.fn(),
  zrem: vi.fn(),
  zremrangebyrank: vi.fn(),
  del: vi.fn(),
}));

vi.mock("@/lib/redis", () => ({ redis: redisMock }));

import { db } from "@umamin/db";
import { getHotScore } from "@/lib/server/hot-score";
import {
  getRedisHotPostIdsPage,
  isRedisHotCursor,
  refreshHotPostRank,
  removeHotPostRank,
  seedHotPostRanks,
} from "./feed-rank";

const HOT_FEED_KEY = "feed:hot:v2";
const LEGACY_HOT_FEED_KEY = "feed:hot:v1";

// Drizzle select chain that resolves `.limit()` to `rows` (single-post read).
function selectReturning(rows: unknown[]) {
  return {
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve(rows),
      }),
    }),
  };
}

// Drizzle select chain for the seed's ordered scan.
function selectOrdered(rows: unknown[]) {
  return {
    from: () => ({
      orderBy: () => ({
        limit: () => Promise.resolve(rows),
      }),
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isRedisHotCursor", () => {
  it("is true for a string with the `rh.` prefix", () => {
    expect(isRedisHotCursor("rh.0")).toBe(true);
    expect(isRedisHotCursor("rh.40")).toBe(true);
    expect(isRedisHotCursor("rh.")).toBe(true);
  });

  it("is false for null, undefined, and non-prefixed strings", () => {
    expect(isRedisHotCursor(null)).toBe(false);
    expect(isRedisHotCursor(undefined)).toBe(false);
    expect(isRedisHotCursor("")).toBe(false);
    expect(isRedisHotCursor("40")).toBe(false);
    // The prefix must be at the start, not merely present.
    expect(isRedisHotCursor("x.rh.0")).toBe(false);
  });
});

describe("getRedisHotPostIdsPage", () => {
  it("returns null when ranked items are below minRankedItems", async () => {
    redisMock.zcard.mockResolvedValue(5);

    const result = await getRedisHotPostIdsPage(null, 20, 10);

    expect(result).toBeNull();
    expect(redisMock.zrange).not.toHaveBeenCalled();
  });

  it("returns null when the offset is past the end of the set", async () => {
    redisMock.zcard.mockResolvedValue(100);

    const result = await getRedisHotPostIdsPage("rh.100", 20, 10);

    expect(result).toBeNull();
    expect(redisMock.zrange).not.toHaveBeenCalled();
  });

  it("returns a full page with a nextCursor when an extra item is peeked", async () => {
    redisMock.zcard.mockResolvedValue(100);
    // pageSize + 1 ids: the extra one signals there is a next page.
    const ids = Array.from({ length: 21 }, (_, i) => `p${i}`);
    redisMock.zrange.mockResolvedValue(ids);

    const result = await getRedisHotPostIdsPage(null, 20, 10);

    expect(redisMock.zrange).toHaveBeenCalledWith(HOT_FEED_KEY, 0, 20, {
      rev: true,
    });
    expect(result).not.toBeNull();
    expect(result?.ids).toHaveLength(20);
    expect(result?.ids).toEqual(ids.slice(0, 20));
    expect(result?.nextCursor).toBe("rh.20");
  });

  it("parses a valid offset cursor into the zrange window", async () => {
    redisMock.zcard.mockResolvedValue(100);
    const ids = Array.from({ length: 21 }, (_, i) => `p${40 + i}`);
    redisMock.zrange.mockResolvedValue(ids);

    const result = await getRedisHotPostIdsPage("rh.40", 20, 10);

    expect(redisMock.zrange).toHaveBeenCalledWith(HOT_FEED_KEY, 40, 60, {
      rev: true,
    });
    expect(result?.nextCursor).toBe("rh.60");
  });

  it("returns nextCursor=null on the last page (exactly pageSize returned)", async () => {
    redisMock.zcard.mockResolvedValue(20);
    const ids = Array.from({ length: 20 }, (_, i) => `p${i}`);
    redisMock.zrange.mockResolvedValue(ids);

    const result = await getRedisHotPostIdsPage(null, 20, 10);

    expect(result?.ids).toHaveLength(20);
    expect(result?.nextCursor).toBeNull();
  });

  it("returns null when fewer than pageSize ids come back", async () => {
    redisMock.zcard.mockResolvedValue(15);
    const ids = Array.from({ length: 15 }, (_, i) => `p${i}`);
    redisMock.zrange.mockResolvedValue(ids);

    const result = await getRedisHotPostIdsPage(null, 20, 10);

    expect(result).toBeNull();
  });

  it("treats an invalid cursor offset as 0", async () => {
    redisMock.zcard.mockResolvedValue(100);
    const ids = Array.from({ length: 21 }, (_, i) => `p${i}`);
    redisMock.zrange.mockResolvedValue(ids);

    const result = await getRedisHotPostIdsPage("rh.notanumber", 20, 10);

    expect(redisMock.zrange).toHaveBeenCalledWith(HOT_FEED_KEY, 0, 20, {
      rev: true,
    });
    expect(result?.nextCursor).toBe("rh.20");
  });

  it("treats a negative cursor offset as 0", async () => {
    redisMock.zcard.mockResolvedValue(100);
    const ids = Array.from({ length: 21 }, (_, i) => `p${i}`);
    redisMock.zrange.mockResolvedValue(ids);

    await getRedisHotPostIdsPage("rh.-5", 20, 10);

    expect(redisMock.zrange).toHaveBeenCalledWith(HOT_FEED_KEY, 0, 20, {
      rev: true,
    });
  });

  it("ignores a non-rh cursor and starts from offset 0", async () => {
    redisMock.zcard.mockResolvedValue(100);
    const ids = Array.from({ length: 21 }, (_, i) => `p${i}`);
    redisMock.zrange.mockResolvedValue(ids);

    await getRedisHotPostIdsPage("plain-uuid-cursor", 20, 10);

    expect(redisMock.zrange).toHaveBeenCalledWith(HOT_FEED_KEY, 0, 20, {
      rev: true,
    });
  });
});

describe("refreshHotPostRank", () => {
  const post = {
    id: "post-1",
    createdAt: new Date("2026-06-04T00:00:00.000Z"),
    likeCount: 5,
    pollVoteCount: 4,
    commentCount: 2,
    repostCount: 1,
  };

  it("zadds the shared log-dampened score and trims when the member is new", async () => {
    vi.mocked(db.select).mockReturnValue(
      // biome-ignore lint/suspicious/noExplicitAny: drizzle chain stub
      selectReturning([post]) as any,
    );
    redisMock.zadd.mockResolvedValue(1); // brand-new member

    await refreshHotPostRank("post-1");

    expect(redisMock.zadd).toHaveBeenCalledTimes(1);
    const [key, arg] = redisMock.zadd.mock.calls[0];
    expect(key).toBe(HOT_FEED_KEY);
    expect(arg.member).toBe("post-1");
    expect(arg.score).toBe(getHotScore(post));

    // engagement = 5 likes + 4 poll votes + 2*3 comments + 1*4 reposts = 19
    const expectedScore =
      post.createdAt.getTime() / 10_000 + Math.log1p(19) * 1500;
    expect(arg.score).toBe(expectedScore);

    // A new member can push the set past the cap (2000) — trim runs.
    expect(redisMock.zremrangebyrank).toHaveBeenCalledWith(
      HOT_FEED_KEY,
      0,
      -2001,
    );
    expect(redisMock.zrem).not.toHaveBeenCalled();
  });

  it("skips the trim when zadd only re-scored an existing member", async () => {
    vi.mocked(db.select).mockReturnValue(
      // biome-ignore lint/suspicious/noExplicitAny: drizzle chain stub
      selectReturning([post]) as any,
    );
    redisMock.zadd.mockResolvedValue(0); // existing member re-scored

    await refreshHotPostRank("post-1");

    expect(redisMock.zadd).toHaveBeenCalledTimes(1);
    expect(redisMock.zremrangebyrank).not.toHaveBeenCalled();
  });

  it("zrems the id when the post no longer exists", async () => {
    vi.mocked(db.select).mockReturnValue(
      // biome-ignore lint/suspicious/noExplicitAny: drizzle chain stub
      selectReturning([]) as any,
    );

    await refreshHotPostRank("ghost");

    expect(redisMock.zrem).toHaveBeenCalledWith(HOT_FEED_KEY, "ghost");
    expect(redisMock.zadd).not.toHaveBeenCalled();
    expect(redisMock.zremrangebyrank).not.toHaveBeenCalled();
  });

  it("scores a zero-engagement post on recency alone", async () => {
    const coldPost = {
      id: "post-2",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      likeCount: 0,
      pollVoteCount: 0,
      commentCount: 0,
      repostCount: 0,
    };
    vi.mocked(db.select).mockReturnValue(
      // biome-ignore lint/suspicious/noExplicitAny: drizzle chain stub
      selectReturning([coldPost]) as any,
    );

    await refreshHotPostRank("post-2");

    const { score } = redisMock.zadd.mock.calls[0][1];
    expect(score).toBe(coldPost.createdAt.getTime() / 10_000);
  });

  it("swallows a Redis failure — rank upkeep must not fail a committed action", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(db.select).mockReturnValue(
      // biome-ignore lint/suspicious/noExplicitAny: drizzle chain stub
      selectReturning([post]) as any,
    );
    redisMock.zadd.mockRejectedValueOnce(new Error("upstash down"));

    await expect(refreshHotPostRank("post-1")).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledTimes(1);

    errorSpy.mockRestore();
  });

  it("swallows a DB failure on the counter read", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(db.select).mockImplementationOnce(() => {
      throw new Error("turso blip");
    });

    await expect(refreshHotPostRank("post-1")).resolves.toBeUndefined();
    expect(redisMock.zadd).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);

    errorSpy.mockRestore();
  });
});

describe("removeHotPostRank", () => {
  it("zrems the id from the hot feed key", async () => {
    await removeHotPostRank("post-9");

    expect(redisMock.zrem).toHaveBeenCalledWith(HOT_FEED_KEY, "post-9");
  });

  it("swallows a Redis failure", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    redisMock.zrem.mockRejectedValueOnce(new Error("upstash down"));

    await expect(removeHotPostRank("post-9")).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledTimes(1);

    errorSpy.mockRestore();
  });
});

describe("seedHotPostRanks", () => {
  const posts = [
    {
      id: "post-1",
      createdAt: new Date("2026-06-04T00:00:00.000Z"),
      likeCount: 5,
      pollVoteCount: 0,
      commentCount: 2,
      repostCount: 1,
    },
    {
      id: "post-2",
      createdAt: new Date("2026-06-03T00:00:00.000Z"),
      likeCount: 0,
      pollVoteCount: 8,
      commentCount: 0,
      repostCount: 0,
    },
  ];

  it("zadds every post with its score in one call and deletes the legacy key", async () => {
    vi.mocked(db.select).mockReturnValue(
      // biome-ignore lint/suspicious/noExplicitAny: drizzle chain stub
      selectOrdered(posts) as any,
    );

    const seeded = await seedHotPostRanks();

    expect(seeded).toBe(2);
    expect(redisMock.zadd).toHaveBeenCalledExactlyOnceWith(
      HOT_FEED_KEY,
      { score: getHotScore(posts[0]), member: "post-1" },
      { score: getHotScore(posts[1]), member: "post-2" },
    );
    expect(redisMock.del).toHaveBeenCalledWith(LEGACY_HOT_FEED_KEY);
  });

  it("still deletes the legacy key when there is nothing to seed", async () => {
    vi.mocked(db.select).mockReturnValue(
      // biome-ignore lint/suspicious/noExplicitAny: drizzle chain stub
      selectOrdered([]) as any,
    );

    const seeded = await seedHotPostRanks();

    expect(seeded).toBe(0);
    expect(redisMock.zadd).not.toHaveBeenCalled();
    expect(redisMock.del).toHaveBeenCalledWith(LEGACY_HOT_FEED_KEY);
  });
});

describe("when the redis binding is null", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("no-ops every redis-touching function without throwing", async () => {
    vi.resetModules();
    vi.doMock("@/lib/redis", () => ({ redis: null }));
    vi.doMock("@umamin/db", () => ({ db: { select: vi.fn() } }));

    const mod = await import("./feed-rank");

    await expect(mod.getRedisHotPostIdsPage(null, 20, 10)).resolves.toBeNull();
    await expect(mod.refreshHotPostRank("x")).resolves.toBeUndefined();
    await expect(mod.removeHotPostRank("x")).resolves.toBeUndefined();
    await expect(mod.seedHotPostRanks()).resolves.toBeNull();

    // No db read is attempted when redis is absent.
    const { db: nullRedisDb } = await import("@umamin/db");
    expect(nullRedisDb.select).not.toHaveBeenCalled();
  });
});
