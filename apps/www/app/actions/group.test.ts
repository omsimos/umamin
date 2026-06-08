import { beforeEach, describe, expect, it, vi } from "vitest";

const updateTag = vi.fn();
const revalidateTag = vi.fn();
vi.mock("next/cache", () => ({
  updateTag: (tag: string) => updateTag(tag),
  revalidateTag: (tag: string, profile: string) => revalidateTag(tag, profile),
}));

// Queue-based chain mocks: each query kind consumes the next result from its
// FIFO in execution order, so tests enqueue results in the order the handler
// runs its statements (plain awaited updates consume an entry too).
const state = {
  selects: [] as unknown[][],
  inserts: [] as unknown[][],
  updates: [] as unknown[][],
  deletes: [] as unknown[][],
  insertThrow: null as Error | null,
};
const insertSpy = vi.fn();
const updateSpy = vi.fn();
const deleteSpy = vi.fn();

function makeSelect() {
  return () => ({
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve(state.selects.shift() ?? []),
      }),
    }),
  });
}

function makeInsert() {
  return (table: unknown) => ({
    values: (values: unknown) => {
      insertSpy(table, values);
      const next = () => {
        if (state.insertThrow) {
          return Promise.reject(state.insertThrow);
        }
        return Promise.resolve(state.inserts.shift() ?? []);
      };
      return Object.assign(Promise.resolve([]), {
        onConflictDoNothing: () => ({ returning: next }),
        returning: next,
      });
    },
  });
}

function makeUpdate() {
  return (table: unknown) => ({
    set: (values: unknown) => ({
      where: () => {
        updateSpy(table, values);
        const rows = state.updates.shift() ?? [];
        return Object.assign(Promise.resolve(rows), {
          returning: () => Promise.resolve(rows),
        });
      },
    }),
  });
}

function makeDelete() {
  return (table: unknown) => ({
    where: () => {
      deleteSpy(table);
      const rows = state.deletes.shift() ?? [];
      return Object.assign(Promise.resolve(rows), {
        returning: () => Promise.resolve(rows),
      });
    },
  });
}

const tx = {
  select: makeSelect(),
  insert: makeInsert(),
  update: makeUpdate(),
  delete: makeDelete(),
};

vi.mock("@umamin/db", () => ({
  db: {
    select: makeSelect(),
    insert: makeInsert(),
    update: makeUpdate(),
    delete: makeDelete(),
    transaction: async (cb: (t: unknown) => Promise<unknown>) => cb(tx),
  },
}));

const getSession = vi.fn();
vi.mock("@/lib/auth", () => ({
  getSession: () => getSession(),
}));

const checkRateLimit = vi.fn();
vi.mock("@/lib/ratelimit", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimit(...args),
  RATE_LIMIT_ERROR: "Too many requests",
}));

const notify = vi.fn();
vi.mock("@/lib/server/notifications", () => ({
  notify: (params: unknown) => notify(params),
}));

import {
  groupMemberTable,
  groupPendingTable,
  groupTable,
} from "@umamin/db/schema/group";
import { userTable } from "@umamin/db/schema/user";
import {
  GROUP_ALREADY_MEMBER_ERROR,
  GROUP_CANNOT_INVITE_SELF_ERROR,
  GROUP_FULL_ERROR,
  GROUP_INVITE_PENDING_ERROR,
  GROUP_JOINED_CAP_ERROR,
  GROUP_NOT_PENDING_ERROR,
  GROUP_OWNED_CAP_ERROR,
  GROUP_OWNER_CANNOT_LEAVE_ERROR,
  GROUP_PLUS_REQUIRED_ERROR,
  GROUP_REQUEST_PENDING_ERROR,
  GROUP_TAG_TAKEN_ERROR,
  GROUP_TARGET_CAPPED_ERROR,
  GROUP_USER_NOT_FOUND_ERROR,
} from "@/lib/group";
import { UNAUTHORIZED_ERROR } from "@/lib/server/errors";
import {
  createGroupAction,
  deleteGroupAction,
  equipGroupBadgeAction,
  inviteToGroupAction,
  kickGroupMemberAction,
  leaveGroupAction,
  requestToJoinGroupAction,
  respondToInviteAction,
  respondToJoinRequestAction,
  updateGroupAction,
} from "./group";

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function plusUser() {
  return {
    id: "owner-1",
    username: "owner-user",
    createdAt: new Date(Date.now() - 2 * YEAR_MS),
  };
}

const groupRow = {
  id: "g1",
  name: "The Bros",
  tag: "BROS",
  creatorId: "owner-1",
  memberCount: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  state.selects = [];
  state.inserts = [];
  state.updates = [];
  state.deletes = [];
  state.insertThrow = null;
  getSession.mockResolvedValue({
    session: { userId: "owner-1" },
    user: plusUser(),
  });
  checkRateLimit.mockResolvedValue(true);
});

const validCreate = {
  name: "The Bros",
  description: "",
  tag: "bros",
  icon: "swords",
  accent: null,
} as const;

describe("createGroupAction", () => {
  it("rejects non-Plus users before any write", async () => {
    getSession.mockResolvedValue({
      session: { userId: "newbie-1" },
      user: { ...plusUser(), id: "newbie-1", createdAt: new Date() },
    });

    const res = await createGroupAction(validCreate);

    expect(res).toEqual({ error: GROUP_PLUS_REQUIRED_ERROR });
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("rejects reserved tags as taken, including leetspeak evasion", async () => {
    expect(await createGroupAction({ ...validCreate, tag: "MODS" })).toEqual({
      error: GROUP_TAG_TAKEN_ERROR,
    });
    expect(await createGroupAction({ ...validCreate, tag: "m0d5" })).toEqual({
      error: GROUP_TAG_TAKEN_ERROR,
    });
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("enforces the one-owned-group cap", async () => {
    state.selects = [[{ id: "g0" }]];

    const res = await createGroupAction(validCreate);

    expect(res).toEqual({ error: GROUP_OWNED_CAP_ERROR });
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("creates the group, owner membership, and auto-equips", async () => {
    state.selects = [[], []]; // owned check, joined-cap check
    state.inserts = [[{ ...groupRow, tag: "BR0S", tagNorm: "BROS" }]];
    state.updates = [[]]; // equip write

    const res = await createGroupAction({ ...validCreate, tag: "br0s" });

    // Display form keeps the typed characters; uniqueness rides the fold.
    expect(insertSpy).toHaveBeenCalledWith(groupTable, {
      name: "The Bros",
      description: null,
      tag: "BR0S",
      tagNorm: "BROS",
      icon: "swords",
      accent: null,
      creatorId: "owner-1",
    });
    expect(insertSpy).toHaveBeenCalledWith(groupMemberTable, {
      groupId: "g1",
      userId: "owner-1",
      role: "owner",
    });
    expect(updateSpy).toHaveBeenCalledWith(userTable, {
      equippedGroupId: "g1",
    });
    expect(updateTag).toHaveBeenCalledWith("user:owner-1");
    expect(updateTag).toHaveBeenCalledWith("user:owner-user");
    expect(updateTag).toHaveBeenCalledWith("user-groups:owner-1");
    expect(revalidateTag).toHaveBeenCalledWith("posts", "max");
    expect(revalidateTag).toHaveBeenCalledWith("notes", "max");
    expect(res).toMatchObject({
      success: true,
      group: { id: "g1", tag: "BR0S" },
    });
  });

  it("maps the tagNorm unique violation to 'tag taken'", async () => {
    state.selects = [[], []];
    state.insertThrow = Object.assign(new Error("insert failed"), {
      cause: {
        code: "SQLITE_CONSTRAINT",
        message: "UNIQUE constraint failed: group.tag_norm",
      },
    });

    const res = await createGroupAction(validCreate);

    expect(res).toEqual({ error: GROUP_TAG_TAKEN_ERROR });
  });
});

describe("inviteToGroupAction", () => {
  it("rejects a non-owner caller", async () => {
    state.selects = [[{ ...groupRow, creatorId: "someone-else" }]];

    const res = await inviteToGroupAction({ groupId: "g1", username: "bob" });

    expect(res).toEqual({ error: UNAUTHORIZED_ERROR });
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("rejects an unknown username", async () => {
    state.selects = [[groupRow], []]; // group, target lookup (none)

    const res = await inviteToGroupAction({ groupId: "g1", username: "ghost" });

    expect(res).toEqual({ error: GROUP_USER_NOT_FOUND_ERROR });
  });

  it("rejects inviting yourself", async () => {
    state.selects = [[groupRow], [{ id: "owner-1" }]];

    const res = await inviteToGroupAction({ groupId: "g1", username: "me" });

    expect(res).toEqual({ error: GROUP_CANNOT_INVITE_SELF_ERROR });
  });

  it("rejects inviting an existing member", async () => {
    state.selects = [[groupRow], [{ id: "bob" }], [{ id: "m1" }]];

    const res = await inviteToGroupAction({ groupId: "g1", username: "bob" });

    expect(res).toEqual({ error: GROUP_ALREADY_MEMBER_ERROR });
  });

  it("sends an invite and notifies the invitee", async () => {
    state.selects = [
      [groupRow], // group
      [{ id: "bob" }], // target user
      [], // not a member
      [], // no existing pending (inside tx)
    ];

    const res = await inviteToGroupAction({ groupId: "g1", username: "bob" });

    expect(insertSpy).toHaveBeenCalledWith(groupPendingTable, {
      groupId: "g1",
      userId: "bob",
      kind: "invite",
    });
    expect(updateTag).toHaveBeenCalledWith("user-groups:bob");
    expect(notify).toHaveBeenCalledWith({
      recipientId: "bob",
      type: "group_invite",
      targetId: "g1",
      actorId: "owner-1",
      preview: "The Bros",
    });
    expect(res).toEqual({ success: true });
  });

  it("auto-accepts when the user already requested to join", async () => {
    state.selects = [
      [groupRow],
      [{ id: "bob" }],
      [], // not yet a member
      [{ kind: "request" }], // crossing request
      [], // joined-cap check inside addActiveMember
    ];
    state.deletes = [[{ id: "p1" }]]; // pending request removed
    state.inserts = [[{ id: "m1" }]]; // member inserted
    state.updates = [[{ id: "g1" }]]; // count bump

    const res = await inviteToGroupAction({ groupId: "g1", username: "bob" });

    expect(insertSpy).toHaveBeenCalledWith(groupMemberTable, {
      groupId: "g1",
      userId: "bob",
    });
    expect(updateTag).toHaveBeenCalledWith("group-members:g1");
    expect(notify).toHaveBeenCalledWith({
      recipientId: "bob",
      type: "group_accept",
      targetId: "g1",
      actorId: "owner-1",
      preview: "The Bros",
    });
    expect(res).toEqual({ success: true, accepted: true });
  });

  it("reports an existing pending invite", async () => {
    state.selects = [[groupRow], [{ id: "bob" }], [], [{ kind: "invite" }]];

    const res = await inviteToGroupAction({ groupId: "g1", username: "bob" });

    expect(res).toEqual({ error: GROUP_INVITE_PENDING_ERROR });
  });
});

describe("requestToJoinGroupAction", () => {
  beforeEach(() => {
    getSession.mockResolvedValue({
      session: { userId: "bob" },
      user: { ...plusUser(), id: "bob", username: "bob-user" },
    });
  });

  it("rejects an existing member", async () => {
    state.selects = [[groupRow], [{ id: "m1" }]];

    const res = await requestToJoinGroupAction({ groupId: "g1" });

    expect(res).toEqual({ error: GROUP_ALREADY_MEMBER_ERROR });
  });

  it("rejects when the requester is already at the joined-groups cap", async () => {
    state.selects = [
      [groupRow],
      [], // not a member
      Array.from({ length: 5 }, (_, i) => ({ id: `m${i}` })), // joined-cap reached
    ];

    const res = await requestToJoinGroupAction({ groupId: "g1" });

    expect(res).toEqual({ error: GROUP_JOINED_CAP_ERROR });
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("creates a request and notifies the creator", async () => {
    // group, not member, under joined-cap, no pending
    state.selects = [[groupRow], [], [], []];

    const res = await requestToJoinGroupAction({ groupId: "g1" });

    expect(insertSpy).toHaveBeenCalledWith(groupPendingTable, {
      groupId: "g1",
      userId: "bob",
      kind: "request",
    });
    expect(updateTag).toHaveBeenCalledWith("group-requests:g1");
    expect(notify).toHaveBeenCalledWith({
      recipientId: "owner-1",
      type: "group_request",
      targetId: "g1",
      actorId: "bob",
      preview: "The Bros",
    });
    expect(res).toEqual({ success: true, requested: true });
  });

  it("auto-joins when the user was already invited", async () => {
    state.selects = [
      [groupRow],
      [], // not a member
      [], // under joined-cap (request-time pre-check)
      [{ kind: "invite" }], // crossing invite (inside tx)
      [], // joined-cap check inside addActiveMember
    ];
    state.deletes = [[{ id: "p1" }]];
    state.inserts = [[{ id: "m1" }]];
    state.updates = [[{ id: "g1" }], [{ id: "bob" }]]; // count bump, auto-equip

    const res = await requestToJoinGroupAction({ groupId: "g1" });

    expect(insertSpy).toHaveBeenCalledWith(groupMemberTable, {
      groupId: "g1",
      userId: "bob",
    });
    expect(notify).toHaveBeenCalledWith({
      recipientId: "owner-1",
      type: "group_join",
      targetId: "g1",
      actorId: "bob",
      preview: "The Bros",
    });
    expect(res).toEqual({ success: true, joined: true, equipped: true });
  });

  it("reports an existing pending request", async () => {
    state.selects = [[groupRow], [], [], [{ kind: "request" }]];

    const res = await requestToJoinGroupAction({ groupId: "g1" });

    expect(res).toEqual({ error: GROUP_REQUEST_PENDING_ERROR });
  });
});

describe("respondToInviteAction", () => {
  beforeEach(() => {
    getSession.mockResolvedValue({
      session: { userId: "bob" },
      user: { ...plusUser(), id: "bob", username: "bob-user" },
    });
  });

  it("errors when there's no pending invite", async () => {
    state.selects = [[]]; // pending invite lookup (inside tx)

    const res = await respondToInviteAction({ groupId: "g1", accept: true });

    expect(res).toEqual({ error: GROUP_NOT_PENDING_ERROR });
  });

  it("accepts an invite, joins, and notifies the creator", async () => {
    state.selects = [
      [{ id: "p1" }], // pending invite
      [{ creatorId: "owner-1", name: "The Bros" }], // group
      [], // joined-cap check
    ];
    state.deletes = [[{ id: "p1" }]];
    state.inserts = [[{ id: "m1" }]];
    state.updates = [[{ id: "g1" }], [{ id: "bob" }]];

    const res = await respondToInviteAction({ groupId: "g1", accept: true });

    expect(insertSpy).toHaveBeenCalledWith(groupMemberTable, {
      groupId: "g1",
      userId: "bob",
    });
    expect(notify).toHaveBeenCalledWith({
      recipientId: "owner-1",
      type: "group_join",
      targetId: "g1",
      actorId: "bob",
      preview: "The Bros",
    });
    expect(res).toEqual({ success: true, accepted: true });
  });

  it("declines an invite without joining", async () => {
    state.selects = [[{ id: "p1" }]];
    state.deletes = [[{ id: "p1" }]];

    const res = await respondToInviteAction({ groupId: "g1", accept: false });

    expect(deleteSpy).toHaveBeenCalledWith(groupPendingTable);
    expect(insertSpy).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
    expect(res).toEqual({ success: true, accepted: false });
  });
});

describe("respondToJoinRequestAction", () => {
  it("rejects a non-owner caller", async () => {
    state.selects = [[{ creatorId: "someone-else", name: "The Bros" }]];

    const res = await respondToJoinRequestAction({
      groupId: "g1",
      userId: "bob",
      accept: true,
    });

    expect(res).toEqual({ error: UNAUTHORIZED_ERROR });
  });

  it("approves a request, adds the member, and notifies them", async () => {
    state.selects = [
      [{ creatorId: "owner-1", name: "The Bros" }], // group
      [{ id: "p1" }], // pending request
      [], // joined-cap check
    ];
    state.deletes = [[{ id: "p1" }]];
    state.inserts = [[{ id: "m1" }]];
    state.updates = [[{ id: "g1" }]]; // count bump (no auto-equip on approve)

    const res = await respondToJoinRequestAction({
      groupId: "g1",
      userId: "bob",
      accept: true,
    });

    expect(insertSpy).toHaveBeenCalledWith(groupMemberTable, {
      groupId: "g1",
      userId: "bob",
    });
    expect(notify).toHaveBeenCalledWith({
      recipientId: "bob",
      type: "group_accept",
      targetId: "g1",
      actorId: "owner-1",
      preview: "The Bros",
    });
    expect(res).toEqual({ success: true, approved: true });
  });

  it("rejects (declines) a request without adding a member", async () => {
    state.selects = [
      [{ creatorId: "owner-1", name: "The Bros" }],
      [{ id: "p1" }],
    ];
    state.deletes = [[{ id: "p1" }]];

    const res = await respondToJoinRequestAction({
      groupId: "g1",
      userId: "bob",
      accept: false,
    });

    expect(insertSpy).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
    expect(res).toEqual({ success: true, approved: false });
  });

  it("rolls back an approval when the group is full", async () => {
    state.selects = [
      [{ creatorId: "owner-1", name: "The Bros" }],
      [{ id: "p1" }],
      [], // joined-cap check
    ];
    state.deletes = [[{ id: "p1" }]];
    state.inserts = [[{ id: "m1" }]];
    state.updates = [[]]; // conditional count bump matched 0 rows → full

    const res = await respondToJoinRequestAction({
      groupId: "g1",
      userId: "bob",
      accept: true,
    });

    expect(res).toEqual({ error: GROUP_FULL_ERROR });
    expect(notify).not.toHaveBeenCalled();
  });

  it("re-words the cap error for the owner when the requester is at their cap", async () => {
    state.selects = [
      [{ creatorId: "owner-1", name: "The Bros" }],
      [{ id: "p1" }],
      Array.from({ length: 5 }, (_, i) => ({ id: `m${i}` })), // requester at cap
    ];
    state.deletes = [[{ id: "p1" }]];
    state.inserts = [[{ id: "m1" }]];

    const res = await respondToJoinRequestAction({
      groupId: "g1",
      userId: "bob",
      accept: true,
    });

    // Owner-facing, not the first-person "You can be in up to 5 groups."
    expect(res).toEqual({ error: GROUP_TARGET_CAPPED_ERROR });
    expect(notify).not.toHaveBeenCalled();
  });

  it("errors when there's no matching request", async () => {
    state.selects = [[{ creatorId: "owner-1", name: "The Bros" }], []];

    const res = await respondToJoinRequestAction({
      groupId: "g1",
      userId: "bob",
      accept: true,
    });

    expect(res).toEqual({ error: GROUP_NOT_PENDING_ERROR });
  });
});

describe("equipGroupBadgeAction", () => {
  it("refuses to equip a group the caller isn't a member of", async () => {
    state.selects = [[]];

    const res = await equipGroupBadgeAction({ groupId: "g-spoof" });

    expect(res).toEqual({ error: UNAUTHORIZED_ERROR });
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("equips for a member and refreshes the feeds", async () => {
    state.selects = [[{ id: "m1" }]];
    state.updates = [[]];

    const res = await equipGroupBadgeAction({ groupId: "g1" });

    expect(updateSpy).toHaveBeenCalledWith(userTable, {
      equippedGroupId: "g1",
    });
    expect(revalidateTag).toHaveBeenCalledWith("posts", "max");
    expect(res).toEqual({ success: true, equippedGroupId: "g1" });
  });

  it("unequips without a membership check", async () => {
    state.updates = [[]];

    const res = await equipGroupBadgeAction({ groupId: null });

    expect(res).toEqual({ success: true, equippedGroupId: null });
    expect(updateSpy).toHaveBeenCalledWith(userTable, {
      equippedGroupId: null,
    });
  });
});

describe("leaveGroupAction", () => {
  it("blocks the owner from leaving", async () => {
    state.selects = [[{ role: "owner" }]];

    const res = await leaveGroupAction({ groupId: "g1" });

    expect(res).toEqual({ error: GROUP_OWNER_CANNOT_LEAVE_ERROR });
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it("removes the membership, decrements, and clears the equip", async () => {
    state.selects = [[{ role: "member" }]];
    state.deletes = [[{ id: "m1" }]];
    state.updates = [[], [{ id: "owner-1" }]]; // count decrement, equip clear

    const res = await leaveGroupAction({ groupId: "g1" });

    expect(deleteSpy).toHaveBeenCalledWith(groupMemberTable);
    expect(updateTag).toHaveBeenCalledWith("group:g1");
    expect(updateTag).toHaveBeenCalledWith("group-members:g1");
    expect(updateTag).toHaveBeenCalledWith("user:owner-user");
    expect(revalidateTag).toHaveBeenCalledWith("posts", "max");
    expect(res).toEqual({ success: true });
  });
});

describe("kickGroupMemberAction", () => {
  it("rejects a non-owner caller", async () => {
    state.selects = [[{ creatorId: "someone-else" }]];

    const res = await kickGroupMemberAction({
      groupId: "g1",
      userId: "victim-1",
    });

    expect(res).toEqual({ error: UNAUTHORIZED_ERROR });
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it("kicks a member and clears their equipped badge", async () => {
    state.selects = [[{ creatorId: "owner-1" }]];
    state.deletes = [[{ id: "m2" }]];
    state.updates = [[], [{ username: "kicked-user" }]];

    const res = await kickGroupMemberAction({
      groupId: "g1",
      userId: "member-2",
    });

    expect(updateTag).toHaveBeenCalledWith("user-groups:member-2");
    expect(updateTag).toHaveBeenCalledWith("user:member-2");
    expect(updateTag).toHaveBeenCalledWith("user:kicked-user");
    expect(revalidateTag).toHaveBeenCalledWith("posts", "max");
    expect(res).toEqual({ success: true });
  });
});

describe("updateGroupAction", () => {
  it("rejects a non-owner", async () => {
    state.selects = [[{ creatorId: "someone-else" }]];

    const res = await updateGroupAction({
      groupId: "g1",
      name: "New Name",
      description: "",
      icon: "ghost",
      accent: "rose",
    });

    expect(res).toEqual({ error: UNAUTHORIZED_ERROR });
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("updates meta and refreshes group + feeds (tag untouchable)", async () => {
    state.selects = [[{ creatorId: "owner-1" }]];
    state.updates = [[]];

    const res = await updateGroupAction({
      groupId: "g1",
      name: "New Name",
      description: "our crew",
      icon: "ghost",
      accent: "rose",
    });

    expect(updateSpy).toHaveBeenCalledWith(groupTable, {
      name: "New Name",
      description: "our crew",
      icon: "ghost",
      accent: "rose",
    });
    expect(updateTag).toHaveBeenCalledWith("group:g1");
    expect(revalidateTag).toHaveBeenCalledWith("posts", "max");
    expect(res).toEqual({ success: true });
  });
});

describe("deleteGroupAction", () => {
  it("rejects a non-owner", async () => {
    state.selects = [[{ creatorId: "someone-else" }]];

    const res = await deleteGroupAction({ groupId: "g1" });

    expect(res).toEqual({ error: UNAUTHORIZED_ERROR });
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it("bulk-clears equips before the cascade delete", async () => {
    state.selects = [[{ creatorId: "owner-1" }]];
    state.updates = [[]]; // bulk equip clear
    state.deletes = [[]];

    const res = await deleteGroupAction({ groupId: "g1" });

    expect(updateSpy).toHaveBeenCalledWith(userTable, {
      equippedGroupId: null,
    });
    expect(deleteSpy).toHaveBeenCalledWith(groupTable);
    expect(updateTag).toHaveBeenCalledWith("group:g1");
    expect(revalidateTag).toHaveBeenCalledWith("posts", "max");
    expect(res).toEqual({ success: true });
  });
});
