import { beforeEach, describe, expect, it, vi } from "vitest";

// Same stubs as actions-auth.test.ts: the actions app pulls the argon2 driver
// in transitively (its .wasm only resolves in the workers pool) while these
// flow tests need real libSQL, which only runs in the node pool.
vi.mock("../src/server-lib/argon2", () => ({
  hash: async (pw: string) =>
    `$argon2id$v=19$m=19456,t=2,p=1$c2FsdA$${Buffer.from(pw).toString("base64")}`,
  verify: async (phc: string, pw: string) =>
    phc.endsWith(Buffer.from(pw).toString("base64")),
}));

const { captureRequestException, captureServerException } = vi.hoisted(() => ({
  captureRequestException: vi.fn(),
  captureServerException: vi.fn(),
}));

vi.mock("../src/server-lib/posthog", () => ({
  captureRequestException,
  captureServerException,
}));

import { dmPurgeTable, dmThreadTable } from "@umamin/db/schema/dm";
import { groupMemberTable, groupTable } from "@umamin/db/schema/group";
import {
  pollOptionTable,
  pollVoteTable,
  postCommentTable,
  postLikeTable,
  postRepostTable,
  postTable,
} from "@umamin/db/schema/post";
import { userFollowTable, userTable } from "@umamin/db/schema/user";
import { eq } from "drizzle-orm";
import type { Db } from "../src/server-lib/db";
import {
  __clearSessionCache,
  createSession,
  generateSessionToken,
} from "../src/server-lib/session";
import { authed, buildApp, call, callJson } from "./helpers/actions";
import { makeTestDb } from "./helpers/db";

const CONFIRM = "delete my account";

// deleteAccountHandler is hand-rolled and resolves the viewer with
// resolveSession (the cookie), not the harness's getSession seam — so these
// tests carry a real session row + cookie.
let cookie = "";

async function seed(db: Db) {
  await db.insert(userTable).values([
    { id: "leaver", username: "u_leaver" },
    { id: "stayer", username: "u_stayer", followerCount: 1 },
    { id: "owner", username: "u_owner" },
  ]);

  await db
    .insert(userFollowTable)
    .values({ followerId: "leaver", followingId: "stayer" });
  await db
    .update(userTable)
    .set({ followingCount: 1 })
    .where(eq(userTable.id, "leaver"));

  await db.insert(groupTable).values({
    id: "g1",
    name: "G",
    tag: "GGGG",
    tagNorm: "GGGG",
    icon: "star",
    creatorId: "owner",
    memberCount: 2,
  });
  await db.insert(groupMemberTable).values([
    { groupId: "g1", userId: "owner", role: "owner" },
    { groupId: "g1", userId: "leaver", role: "member" },
  ]);

  // repostCount 3: the quote below plus reposts from leaver and owner.
  await db.insert(postTable).values({
    id: "p1",
    content: "poll",
    authorId: "stayer",
    pollVoteCount: 1,
    repostCount: 3,
    // Two comments from leaver and one from owner: two commenters. leaver
    // reposted and quoted, owner reposted: two resharers.
    commentCount: 3,
    commenterCount: 2,
    likeCount: 2,
    likerCount: 2,
    voterCount: 1,
    resharerCount: 2,
    pollEndsAt: new Date(Date.now() + 1e7),
  });
  await db.insert(pollOptionTable).values([
    { id: "o1", postId: "p1", idx: 0, label: "a", voteCount: 1 },
    { id: "o2", postId: "p1", idx: 1, label: "b", voteCount: 0 },
  ]);
  await db
    .insert(pollVoteTable)
    .values({ postId: "p1", optionId: "o1", userId: "leaver" });
  await db.insert(postLikeTable).values([
    { postId: "p1", userId: "leaver" },
    { postId: "p1", userId: "owner" },
  ]);
  await db.insert(postRepostTable).values([
    { postId: "p1", userId: "leaver" },
    { postId: "p1", userId: "owner" },
  ]);
  await db.insert(postCommentTable).values([
    { id: "c1", postId: "p1", authorId: "leaver", content: "a" },
    { id: "c2", postId: "p1", authorId: "leaver", content: "b" },
    { id: "c3", postId: "p1", authorId: "owner", content: "c" },
  ]);

  await db.insert(postTable).values({
    id: "q1",
    content: "quote",
    authorId: "leaver",
    quotedPostId: "p1",
  });

  const token = generateSessionToken();
  await createSession(db, token, "leaver");
  cookie = `session=${token}`;
}

describe("deleteAccount (real libSQL)", () => {
  let db: Db;

  beforeEach(async () => {
    __clearSessionCache();
    captureRequestException.mockClear();
    db = await makeTestDb();
    await seed(db);
  });

  it("removes the user and reverses every denormalized counter it touched", async () => {
    const app = buildApp(db, authed("leaver"));
    const { json } = await callJson(
      app,
      "deleteAccount",
      { confirmation: CONFIRM },
      {},
      { cookie },
    );
    expect(json).toEqual({ redirect: "/login" });

    expect(
      await db.select().from(userTable).where(eq(userTable.id, "leaver")),
    ).toHaveLength(0);

    const [stayer] = await db
      .select({ followerCount: userTable.followerCount })
      .from(userTable)
      .where(eq(userTable.id, "stayer"));
    expect(stayer.followerCount).toBe(0);

    const [group] = await db
      .select({ memberCount: groupTable.memberCount })
      .from(groupTable)
      .where(eq(groupTable.id, "g1"));
    expect(group.memberCount).toBe(1);

    const [o1] = await db
      .select({ voteCount: pollOptionTable.voteCount })
      .from(pollOptionTable)
      .where(eq(pollOptionTable.id, "o1"));
    expect(o1.voteCount).toBe(0);

    const [p1] = await db
      .select({
        pollVoteCount: postTable.pollVoteCount,
        repostCount: postTable.repostCount,
        commentCount: postTable.commentCount,
        commenterCount: postTable.commenterCount,
        likerCount: postTable.likerCount,
        voterCount: postTable.voterCount,
        resharerCount: postTable.resharerCount,
      })
      .from(postTable)
      .where(eq(postTable.id, "p1"));
    expect(p1.pollVoteCount).toBe(0);
    expect(p1.repostCount).toBe(1);
    expect(p1.commentCount).toBe(1);
    expect(p1.commenterCount).toBe(1);
    expect(p1.likerCount).toBe(1);
    expect(p1.voterCount).toBe(0);
    // leaver both reposted and quoted, and counts once.
    expect(p1.resharerCount).toBe(1);
  });

  it("rejects a wrong confirmation phrase with an error, not a redirect", async () => {
    const app = buildApp(db, authed("leaver"));
    const { json } = await callJson(
      app,
      "deleteAccount",
      { confirmation: "nope" },
      {},
      { cookie },
    );
    expect(json).toHaveProperty("error");
    expect(json).not.toHaveProperty("redirect");
    expect(
      await db.select().from(userTable).where(eq(userTable.id, "leaver")),
    ).toHaveLength(1);
  });

  it("reports an error and keeps the account when the transaction fails", async () => {
    const broken = Object.create(db, {
      transaction: {
        value: async () => {
          throw new Error("turso down");
        },
      },
    }) as Db;
    const app = buildApp(broken, authed("leaver"));
    const res = await call(
      app,
      "deleteAccount",
      { confirmation: CONFIRM },
      {},
      { cookie },
    );
    const json = (await res.json()) as Record<string, unknown>;

    expect(json).toHaveProperty("error");
    expect(json).not.toHaveProperty("redirect");
    // A failed delete must not clear this device's session cookie.
    expect(res.headers.get("set-cookie") ?? "").not.toMatch(/max-age=0/i);
    expect(
      await db.select().from(userTable).where(eq(userTable.id, "leaver")),
    ).toHaveLength(1);
  });

  it("queues the user's conversations for a Durable Object purge", async () => {
    await db.insert(dmThreadTable).values({
      id: "leaver:stayer",
      userLowId: "leaver",
      userHighId: "stayer",
      lastSenderId: "stayer",
      lastSeq: 3,
    });
    const app = buildApp(db, authed("leaver"));
    await callJson(
      app,
      "deleteAccount",
      { confirmation: CONFIRM },
      {},
      { cookie },
    );

    expect(await db.select().from(dmThreadTable)).toHaveLength(0);
    expect(
      (await db.select().from(dmPurgeTable)).map((r) => r.threadId),
    ).toEqual(["leaver:stayer"]);
  });
});
