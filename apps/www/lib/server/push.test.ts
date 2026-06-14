import { describe, expect, it, vi } from "vitest";

// push.ts imports the db root (builds a libSQL client) and web-push (Node
// crypto). Neither is needed to assert the static copy map's invariants.
vi.mock("@umamin/db", () => ({ db: {} }));
vi.mock("web-push", () => ({
  default: { setVapidDetails: vi.fn(), sendNotification: vi.fn() },
}));

import { PUSH_COPY } from "./push";

// Mirrors the NotificationType union in @umamin/db/schema/notification. The
// Record<NotificationType,…> type already makes a missing entry a compile
// error; this is the runtime backstop that the map stays total.
const ALL_TYPES = [
  "like",
  "comment",
  "follow",
  "message",
  "reply",
  "vote",
  "group_join",
  "group_invite",
  "group_request",
  "group_accept",
  "group_mention",
] as const;

describe("PUSH_COPY", () => {
  it("covers exactly every notification type", () => {
    expect(Object.keys(PUSH_COPY).sort()).toEqual([...ALL_TYPES].sort());
  });

  it("never reveals a sender for anonymous types (message, reply)", () => {
    expect(PUSH_COPY.message.anonymous).toBe(true);
    expect(PUSH_COPY.reply.anonymous).toBe(true);
    // The title must be identical whether or not an actor is supplied — a leak
    // here would surface a sender on an anonymous-by-design notification.
    expect(PUSH_COPY.message.title("attacker")).toBe(
      PUSH_COPY.message.title(null),
    );
    expect(PUSH_COPY.message.title("attacker")).not.toContain("attacker");
    expect(PUSH_COPY.reply.title("attacker")).toBe(PUSH_COPY.reply.title(null));
    expect(PUSH_COPY.reply.title("attacker")).not.toContain("attacker");
  });

  it("produces a non-empty title for every type, with and without an actor", () => {
    for (const type of ALL_TYPES) {
      expect(PUSH_COPY[type].title("alice").length).toBeGreaterThan(0);
      expect(PUSH_COPY[type].title(null).length).toBeGreaterThan(0);
    }
  });

  it("names the actor on non-anonymous types when one is resolved", () => {
    expect(PUSH_COPY.like.title("alice")).toContain("@alice");
    expect(PUSH_COPY.comment.title("alice")).toContain("@alice");
    expect(PUSH_COPY.follow.title("bob")).toContain("@bob");
    expect(PUSH_COPY.group_mention.title("carol")).toContain("@carol");
  });

  it("never deep-links to '/' and uses the actor for follow", () => {
    expect(PUSH_COPY.follow.url("", "dave")).toBe("/user/dave");
    expect(PUSH_COPY.follow.url("", null)).toBe("/notifications");
    expect(PUSH_COPY.like.url("post1", null)).toBe("/post/post1");
    for (const type of ALL_TYPES) {
      expect(PUSH_COPY[type].url("x", "u")).not.toBe("/");
    }
  });

  it("deep-links a reply to the Sent tab (matches the in-app notification card)", () => {
    expect(PUSH_COPY.reply.url("msg1", null)).toBe("/inbox?tab=sent");
    expect(PUSH_COPY.message.url("", null)).toBe("/inbox");
  });
});
