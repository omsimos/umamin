import { groupTable } from "@umamin/db/schema/group";
import { userTable } from "@umamin/db/schema/user";
import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readsApp } from "../src/api/routes";
import { __setReadDb } from "../src/api/routes/_shared";
import {
  competitionRanks,
  LEADERBOARD_LIMIT,
  LEADERBOARD_RANK_CAP,
} from "../src/lib/leaderboard";
import type { Db } from "../src/server-lib/db";
import type { AppEnv } from "../src/server-lib/env";
import {
  getLeaderboard,
  getViewerRank,
  leaderboardListQuery,
  leaderboardRankCountQuery,
} from "../src/server-lib/leaderboard";
import {
  __clearSessionCache,
  createSession,
  generateSessionToken,
} from "../src/server-lib/session";
import { makeTestDb } from "./helpers/db";

type Seed = {
  id: string;
  points?: number;
  streakBest?: number;
  createdAt?: number;
  bannedAt?: number;
  leaderboardHidden?: boolean;
  equippedGroupId?: string;
};

async function seed(db: Db, users: Seed[]) {
  await db.insert(userTable).values(
    users.map((u, i) => ({
      id: u.id,
      username: `u_${u.id}`,
      points: u.points ?? 0,
      streakBest: u.streakBest ?? 0,
      createdAt: new Date((u.createdAt ?? i + 1) * 1000),
      bannedAt: u.bannedAt ? new Date(u.bannedAt * 1000) : null,
      leaderboardHidden: u.leaderboardHidden ?? false,
      equippedGroupId: u.equippedGroupId ?? null,
    })),
  );
}

describe("competitionRanks", () => {
  it("shares a rank across ties and skips past them", () => {
    expect(competitionRanks([900, 800, 800, 800, 700, 700, 1])).toEqual([
      1, 2, 2, 2, 5, 5, 7,
    ]);
  });
});

describe("leaderboard reads (real libSQL)", () => {
  let db: Db;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("ranks aura high to low and leaves out banned, hidden and zero-aura users", async () => {
    await seed(db, [
      { id: "a", points: 50 },
      { id: "b", points: 900 },
      { id: "banned", points: 5000, bannedAt: 1 },
      { id: "hidden", points: 4000, leaderboardHidden: true },
      { id: "zero", points: 0 },
      { id: "c", points: 300 },
    ]);

    const { entries } = await getLeaderboard(db, "aura");
    expect(entries.map((e) => [e.rank, e.user.id, e.value])).toEqual([
      [1, "b", 900],
      [2, "c", 300],
      [3, "a", 50],
    ]);
  });

  it("lists older accounts first within a tie and gives them the same rank", async () => {
    await seed(db, [
      { id: "newer", points: 100, createdAt: 50 },
      { id: "older", points: 100, createdAt: 10 },
      { id: "top", points: 200, createdAt: 99 },
      { id: "after", points: 10, createdAt: 1 },
    ]);

    const { entries } = await getLeaderboard(db, "aura");
    expect(entries.map((e) => [e.rank, e.user.id])).toEqual([
      [1, "top"],
      [2, "older"],
      [2, "newer"],
      [4, "after"],
    ]);
  });

  it("ranks best streaks and leaves out streaks under 2 days", async () => {
    await seed(db, [
      { id: "one", streakBest: 1, points: 999 },
      { id: "long", streakBest: 30 },
      { id: "short", streakBest: 2 },
    ]);

    const { entries } = await getLeaderboard(db, "streak");
    expect(entries.map((e) => [e.user.id, e.value])).toEqual([
      ["long", 30],
      ["short", 2],
    ]);
  });

  it("caps the list and ships only the lean user fields plus the badge", async () => {
    await seed(
      db,
      Array.from({ length: LEADERBOARD_LIMIT + 5 }, (_, i) => ({
        id: `u${i}`,
        points: 1000 - i,
        equippedGroupId: i === 0 ? "g1" : undefined,
      })),
    );
    await db.insert(groupTable).values({
      id: "g1",
      name: "Group",
      tag: "ABCD",
      tagNorm: "ABCD",
      icon: "star",
      creatorId: "u0",
    });

    const { entries } = await getLeaderboard(db, "aura");
    expect(entries).toHaveLength(LEADERBOARD_LIMIT);
    expect(Object.keys(entries[0].user).sort()).toEqual([
      "displayName",
      "groupBadge",
      "id",
      "imageUrl",
      "username",
    ]);
    expect(entries[0].user.groupBadge?.tag).toBe("ABCD");
    expect(entries[1].user.groupBadge).toBeNull();
  });

  it("gives the viewer a competition rank that matches the list", async () => {
    await seed(db, [
      { id: "top", points: 500 },
      { id: "tie1", points: 300 },
      { id: "me", points: 300 },
      { id: "banned", points: 9000, bannedAt: 1 },
      { id: "hidden", points: 9000, leaderboardHidden: true },
    ]);

    expect(await getViewerRank(db, "aura", "me")).toEqual({
      rank: 2,
      value: 300,
      hidden: false,
    });
  });

  it("returns no rank for a hidden viewer or one below the minimum", async () => {
    await seed(db, [
      { id: "hidden", points: 300, leaderboardHidden: true },
      { id: "fresh", points: 0, streakBest: 1 },
    ]);

    expect(await getViewerRank(db, "aura", "hidden")).toEqual({
      rank: null,
      value: 300,
      hidden: true,
    });
    expect(await getViewerRank(db, "streak", "fresh")).toEqual({
      rank: null,
      value: 1,
      hidden: false,
    });
  });

  it("stops counting at the cap", async () => {
    await seed(db, [
      ...Array.from({ length: LEADERBOARD_RANK_CAP }, (_, i) => ({
        id: `h${i}`,
        points: 100,
      })),
      { id: "me", points: 1 },
      { id: "almost", points: 2 },
    ]);

    // 1,000 users rank above "almost", which would make it #1,001.
    expect((await getViewerRank(db, "aura", "almost")).rank).toBeNull();
    expect((await getViewerRank(db, "aura", "me")).rank).toBeNull();
  });
});

// Turso bills per row scanned. These pin the plans of the exact queries the
// server runs, so a predicate edit that stops matching the partial indexes
// fails here instead of quietly scanning and sorting the user table.
describe("leaderboard query plans", () => {
  let db: Db;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  async function plan(query: { toSQL(): { sql: string; params: unknown[] } }) {
    const { sql: text, params } = query.toSQL();
    const rows = await db.all<{ detail: string }>(
      sql.join([
        sql.raw("EXPLAIN QUERY PLAN "),
        sql.raw(
          text.replace(/\?/g, () => {
            const value = params.shift();
            return typeof value === "string" ? `'${value}'` : String(value);
          }),
        ),
      ]),
    );
    return rows.map((r) => r.detail).join(" | ");
  }

  it.each([
    ["aura", "user_points_rank_idx"],
    ["streak", "user_streak_best_rank_idx"],
  ] as const)("the %s list walks %s without a sort", async (tab, index) => {
    const detail = await plan(leaderboardListQuery(db, tab));
    expect(detail).toContain(index);
    expect(detail).not.toMatch(/SCAN "?user"?(?!_)/);
    expect(detail).not.toContain("TEMP B-TREE");
  });

  it.each([
    ["aura", "user_points_rank_idx"],
    ["streak", "user_streak_best_rank_idx"],
  ] as const)("the %s rank count seeks %s", async (tab, index) => {
    const detail = await plan(leaderboardRankCountQuery(db, tab, 10));
    expect(detail).toContain(index);
    expect(detail).not.toMatch(/SCAN "?user"?(?!_)/);
  });
});

describe("leaderboard routes", () => {
  let db: Db;
  const store = new Map<string, Response>();

  const ctx = {
    waitUntil: (p: Promise<unknown>) => {
      void p;
    },
    passThroughOnException: () => {},
  } as unknown as ExecutionContext;

  function fetchApp(path: string, init: RequestInit = {}) {
    return new Hono()
      .route("/", readsApp)
      .fetch(
        new Request(`https://x.test${path}`, init),
        {} as unknown as AppEnv,
        ctx,
      );
  }

  beforeEach(async () => {
    __clearSessionCache();
    store.clear();
    (globalThis as { caches?: unknown }).caches = {
      default: {
        match: async (req: Request) => store.get(req.url)?.clone(),
        put: async (req: Request, res: Response) => {
          store.set(req.url, res.clone());
        },
      },
    };
    db = await makeTestDb();
    __setReadDb(() => db);
  });

  afterEach(() => {
    __setReadDb(null);
  });

  it("rejects an unknown tab without caching it", async () => {
    const res = await fetchApp("/public/leaderboard?tab=weekly");
    expect(res.status).toBe(400);
    expect(store.size).toBe(0);
  });

  it("keys the cache on the tab only", async () => {
    await seed(db, [{ id: "a", points: 10 }]);
    const first = await fetchApp("/public/leaderboard?tab=aura");
    expect(first.status).toBe(200);
    expect(first.headers.get("cache-control")).toContain("s-maxage=600");

    __setReadDb(() => {
      throw new Error("db must not be touched on a cache hit");
    });
    const second = await fetchApp("/public/leaderboard?utm_source=x&tab=aura");
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual(await first.json());
  });

  it("serves the viewer's rank only to a signed-in viewer", async () => {
    await seed(db, [
      { id: "top", points: 50 },
      { id: "me", points: 20 },
    ]);
    expect((await fetchApp("/leaderboard/me?tab=aura")).status).toBe(401);

    const token = generateSessionToken();
    await createSession(db, token, "me");
    const res = await fetchApp("/leaderboard/me?tab=aura", {
      headers: { cookie: `session=${token}` },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(await res.json()).toEqual({ rank: 2, value: 20, hidden: false });
  });
});
