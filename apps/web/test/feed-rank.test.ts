import { postTable } from "@umamin/db/schema/post";
import { userTable } from "@umamin/db/schema/user";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../src/server-lib/db";
import { recomputeHotFeed } from "../src/server-lib/feed-rank";
import { getHotScore } from "../src/server-lib/hot-score";
import { makeTestDb } from "./helpers/db";

// recomputeHotFeed is the cron body: one bounded Turso read → score → sort →
// one KV write. It needs a real DB (libSQL :memory:, node pool) so it runs here
// rather than in the workerd pool; a Map-backed fake KV stands in for the write.
const HOT_FEED_KEY = "feed:hot:v2";

function fakeKv() {
  const store = new Map<string, string>();
  return {
    kv: {
      get: async (_key: string) => null,
      put: async (key: string, value: string) => {
        store.set(key, value);
      },
    } as unknown as KVNamespace,
    read: (key: string) => {
      const raw = store.get(key);
      return raw ? (JSON.parse(raw) as string[]) : null;
    },
  };
}

type SeedPost = {
  id: string;
  createdAt: Date;
  likeCount?: number;
  pollVoteCount?: number;
  commentCount?: number;
  repostCount?: number;
};

async function seed(db: Db, posts: SeedPost[]) {
  await db.insert(userTable).values({ id: "u1", username: "author" });
  for (const p of posts) {
    await db.insert(postTable).values({
      id: p.id,
      content: `post ${p.id}`,
      authorId: "u1",
      createdAt: p.createdAt,
      likeCount: p.likeCount ?? 0,
      pollVoteCount: p.pollVoteCount ?? 0,
      commentCount: p.commentCount ?? 0,
      repostCount: p.repostCount ?? 0,
    });
  }
}

describe("recomputeHotFeed", () => {
  let db: Db;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("no-ops without a KV binding", async () => {
    await expect(recomputeHotFeed(db, undefined)).resolves.toBeUndefined();
  });

  it("writes the ids ordered by the shared Hot score, highest first", async () => {
    const now = Date.now();
    const posts: SeedPost[] = [
      { id: "old", createdAt: new Date(now - 100 * 864e5) },
      { id: "engaged", createdAt: new Date(now - 36e5), likeCount: 100 },
      { id: "fresh", createdAt: new Date(now) },
    ];
    await seed(db, posts);

    const { kv, read } = fakeKv();
    await recomputeHotFeed(db, kv);

    const stored = read(HOT_FEED_KEY);
    expect(stored).not.toBeNull();

    // Expected order = the same static Hot score, descending.
    const expected = [...posts]
      .sort(
        (a, b) =>
          getHotScore({
            createdAt: b.createdAt,
            likeCount: b.likeCount ?? 0,
            pollVoteCount: 0,
            commentCount: 0,
            repostCount: 0,
          }) -
          getHotScore({
            createdAt: a.createdAt,
            likeCount: a.likeCount ?? 0,
            pollVoteCount: 0,
            commentCount: 0,
            repostCount: 0,
          }),
      )
      .map((p) => p.id);

    expect(stored).toEqual(expected);
    // The recent-but-cold post still beats the 100-day-old one; the engaged
    // post pins above a fresh one for the log-dampened window.
    expect(stored?.[stored.length - 1]).toBe("old");
  });

  it("writes an empty list when there are no posts", async () => {
    await db.insert(userTable).values({ id: "u1", username: "author" });
    const { kv, read } = fakeKv();
    await recomputeHotFeed(db, kv);
    expect(read(HOT_FEED_KEY)).toEqual([]);
  });
});
