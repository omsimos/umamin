import { beforeEach, describe, expect, it, vi } from "vitest";

const updateTag = vi.fn();
vi.mock("next/cache", () => ({
  updateTag: (tag: string) => updateTag(tag),
  revalidateTag: vi.fn(),
}));

// FIFO results for each select().…limit() in call order, plus insert fixtures.
const state = {
  selectQueue: [] as unknown[][],
  inserted: [] as unknown[],
};
const insertValues = vi.fn();
const updateSet = vi.fn();
const deleteWhere = vi.fn();

function selectChain() {
  const result = () => Promise.resolve(state.selectQueue.shift() ?? []);
  const chain: Record<string, unknown> = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => result(),
  };
  return chain;
}

vi.mock("@umamin/db", () => ({
  db: {
    select: () => selectChain(),
    insert: () => ({
      values: (values: unknown) => {
        insertValues(values);
        return {
          returning: () => Promise.resolve(state.inserted),
          onConflictDoNothing: () => Promise.resolve(),
          onConflictDoUpdate: () => Promise.resolve(),
        };
      },
    }),
    update: () => ({
      set: (values: unknown) => {
        updateSet(values);
        return { where: () => Promise.resolve() };
      },
    }),
    delete: () => ({
      where: (condition: unknown) => {
        deleteWhere(condition);
        return Promise.resolve();
      },
    }),
  },
}));

const getSession = vi.fn();
vi.mock("@/lib/auth", () => ({
  getSession: () => getSession(),
}));

const checkRateLimit = vi.fn();
vi.mock("@/lib/ratelimit", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimit(...args),
  getClientIp: vi.fn(),
  RATE_LIMIT_ERROR: "Too many requests",
}));

const redisSet = vi.fn();
const redisDel = vi.fn();
vi.mock("@/lib/redis", () => ({
  redis: {
    set: (...a: unknown[]) => redisSet(...a),
    del: (...a: unknown[]) => redisDel(...a),
  },
}));

vi.mock("@/lib/server/notifications", () => ({ notify: vi.fn() }));

vi.mock("@umamin/encryption", () => ({
  aesEncrypt: vi.fn(async (s: string) => `enc:${s}`),
}));

// Group chat ships OFF behind a kill switch; force it on here so these tests
// verify the underlying send/react/delete logic (which must still work when the
// flag is flipped back on).
vi.mock("@/lib/group", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/group")>()),
  GROUP_CHAT_ENABLED: true,
}));

import {
  deleteGroupMessageAction,
  reactToGroupMessageAction,
  sendGroupMessageAction,
} from "./group-chat";

beforeEach(() => {
  vi.clearAllMocks();
  state.selectQueue = [];
  state.inserted = [{ id: "msg-1", createdAt: new Date(1780000000000) }];
  getSession.mockResolvedValue({
    session: { userId: "viewer-1" },
    user: { id: "viewer-1" },
  });
  checkRateLimit.mockResolvedValue(true);
});

describe("sendGroupMessageAction", () => {
  it("inserts an encrypted message, bumps lastMessageAt, busts cache, advances tail", async () => {
    state.selectQueue = [[{ id: "gm-1" }]]; // membership probe

    const res = await sendGroupMessageAction({
      groupId: "g1",
      content: "  hello team  ",
    });

    expect(res).toEqual({
      success: true,
      id: "msg-1",
      createdAt: new Date(1780000000000),
    });
    expect(insertValues).toHaveBeenCalledExactlyOnceWith({
      groupId: "g1",
      senderId: "viewer-1",
      content: "enc:hello team",
      replyToMessageId: null,
    });
    expect(updateSet).toHaveBeenCalledExactlyOnceWith({
      lastMessageAt: new Date(1780000000000),
    });
    expect(updateTag).toHaveBeenCalledWith("group-messages:g1");
    expect(redisSet).toHaveBeenCalledExactlyOnceWith(
      "group-chat:g1:tail",
      1780000000000,
    );
  });

  it("rejects a non-member without writing anything", async () => {
    state.selectQueue = [[]]; // not a member

    const res = await sendGroupMessageAction({ groupId: "g1", content: "hi" });

    expect(res).toEqual({ error: "Unauthorized" });
    expect(insertValues).not.toHaveBeenCalled();
    expect(redisSet).not.toHaveBeenCalled();
  });

  it("rate limits before any membership read or write", async () => {
    checkRateLimit.mockResolvedValue(false);

    const res = await sendGroupMessageAction({ groupId: "g1", content: "hi" });

    expect(res).toEqual({ error: "Too many requests" });
    expect(insertValues).not.toHaveBeenCalled();
  });
});

describe("deleteGroupMessageAction", () => {
  it("lets the author delete their own message and recomputes the tail", async () => {
    state.selectQueue = [
      [{ senderId: "viewer-1" }], // message lookup — own
      [{ createdAt: new Date(1779999999000) }], // new newest after delete
    ];

    const res = await deleteGroupMessageAction({
      groupId: "g1",
      messageId: "msg-1",
    });

    expect(res).toEqual({ success: true });
    expect(deleteWhere).toHaveBeenCalledOnce();
    expect(redisSet).toHaveBeenCalledExactlyOnceWith(
      "group-chat:g1:tail",
      1779999999000,
    );
  });

  it("lets the group owner delete someone else's message", async () => {
    state.selectQueue = [
      [{ senderId: "someone-else" }], // not the author
      [{ role: "owner" }], // viewer is the owner
      [], // no messages left → tail cleared
    ];

    const res = await deleteGroupMessageAction({
      groupId: "g1",
      messageId: "msg-9",
    });

    expect(res).toEqual({ success: true });
    expect(deleteWhere).toHaveBeenCalledOnce();
    expect(redisDel).toHaveBeenCalledExactlyOnceWith("group-chat:g1:tail");
  });

  it("denies a non-author non-owner and deletes nothing", async () => {
    state.selectQueue = [
      [{ senderId: "someone-else" }], // not the author
      [{ role: "member" }], // viewer is a plain member
    ];

    const res = await deleteGroupMessageAction({
      groupId: "g1",
      messageId: "msg-9",
    });

    expect(res).toEqual({ error: "Unauthorized" });
    expect(deleteWhere).not.toHaveBeenCalled();
  });

  it("is a silent no-op for a missing/foreign message", async () => {
    state.selectQueue = [[]]; // message not found in this group

    const res = await deleteGroupMessageAction({
      groupId: "g1",
      messageId: "ghost",
    });

    expect(res).toEqual({ success: true });
    expect(deleteWhere).not.toHaveBeenCalled();
  });
});

describe("reactToGroupMessageAction", () => {
  it("adds a new reaction and bumps the reaction version", async () => {
    state.selectQueue = [
      [{ id: "gm-1" }], // membership
      [{ id: "m1" }], // message exists in group
      [], // no existing reaction
    ];

    const res = await reactToGroupMessageAction({
      groupId: "g1",
      messageId: "m1",
      emoji: "👍",
    });

    expect(res).toEqual({ success: true, viewerReaction: "👍" });
    expect(insertValues).toHaveBeenCalledExactlyOnceWith({
      messageId: "m1",
      userId: "viewer-1",
      emoji: "👍",
    });
    expect(redisSet).toHaveBeenCalledExactlyOnceWith(
      "group-chat:g1:rxn",
      expect.any(Number),
    );
  });

  it("toggles off when re-reacting with the same emoji", async () => {
    state.selectQueue = [
      [{ id: "gm-1" }],
      [{ id: "m1" }],
      [{ id: "rx1", emoji: "👍" }], // existing same emoji
    ];

    const res = await reactToGroupMessageAction({
      groupId: "g1",
      messageId: "m1",
      emoji: "👍",
    });

    expect(res).toEqual({ success: true, viewerReaction: null });
    expect(deleteWhere).toHaveBeenCalledOnce();
    expect(insertValues).not.toHaveBeenCalled();
  });

  it("replaces when reacting with a different emoji", async () => {
    state.selectQueue = [
      [{ id: "gm-1" }],
      [{ id: "m1" }],
      [{ id: "rx1", emoji: "❤️" }], // existing different emoji
    ];

    const res = await reactToGroupMessageAction({
      groupId: "g1",
      messageId: "m1",
      emoji: "👍",
    });

    expect(res).toEqual({ success: true, viewerReaction: "👍" });
    expect(updateSet).toHaveBeenCalledOnce();
    expect(deleteWhere).not.toHaveBeenCalled();
  });

  it("rejects an emoji outside the allowed set before any read", async () => {
    const res = await reactToGroupMessageAction({
      groupId: "g1",
      messageId: "m1",
      emoji: "💩",
    });

    expect(res).toEqual({ error: "Invalid reaction" });
    expect(insertValues).not.toHaveBeenCalled();
    expect(redisSet).not.toHaveBeenCalled();
  });
});
