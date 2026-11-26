import { WebPushError } from "@mmmike/web-push/send";
import { pushSubscriptionTable } from "@umamin/db/schema/push-subscription";
import { userTable } from "@umamin/db/schema/user";
import { describe, expect, it, vi } from "vitest";
import { ALL_PUSH_CATEGORIES } from "../src/lib/push-prefs";
import type { AppEnv } from "../src/server-lib/env";
import {
  PUSH_COPY,
  sendPushForNotification,
} from "../src/server-lib/notification-push";
import { captureServerException } from "../src/server-lib/posthog";
import { sendPush } from "../src/server-lib/push";
import { makeTestDb } from "./helpers/db";

vi.mock("../src/server-lib/posthog", () => ({
  captureServerException: vi.fn(),
}));

// Keeps the real endpoint allowlist; only the network send is faked.
vi.mock("../src/server-lib/push", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/server-lib/push")>();
  return { ...actual, sendPush: vi.fn() };
});

// Ported from apps/www/lib/server/push.test.ts — asserts the static copy map's
// invariants (no DB / web-push needed). The Record<NotificationType,…> type
// already makes a missing entry a compile error; this is the runtime backstop
// that the map stays total.
const ALL_TYPES = [
  "like",
  "comment",
  "follow",
  "message",
  "reply",
  "thread",
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

  it("never reveals a sender for anonymous types (message, reply, thread)", () => {
    expect(PUSH_COPY.message.anonymous).toBe(true);
    expect(PUSH_COPY.reply.anonymous).toBe(true);
    expect(PUSH_COPY.thread.anonymous).toBe(true);
    expect(PUSH_COPY.thread.title("attacker")).toBe(
      PUSH_COPY.thread.title(null),
    );
    expect(PUSH_COPY.thread.title("attacker")).not.toContain("attacker");
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

  it("deep-links reply/thread to the thread page (matches the in-app notification card)", () => {
    expect(PUSH_COPY.reply.url("msg1", null)).toBe("/inbox/msg1");
    expect(PUSH_COPY.reply.url("", null)).toBe("/inbox?tab=sent");
    expect(PUSH_COPY.thread.url("msg1", null)).toBe("/inbox/msg1");
    expect(PUSH_COPY.message.url("", null)).toBe("/inbox");
  });
});

describe("sendPushForNotification failure reports", () => {
  it("hands the report to the request's defer", async () => {
    const db = await makeTestDb();
    await db.insert(userTable).values({
      id: "u1",
      username: "one",
      pushPrefs: ALL_PUSH_CATEGORIES,
    });
    await db.insert(pushSubscriptionTable).values({
      userId: "u1",
      endpoint: "https://fcm.googleapis.com/fcm/send/u1",
      p256dh: "k",
      auth: "a",
    });
    const rejected = new WebPushError("Push service error", 403, "", "", null);
    vi.mocked(sendPush).mockRejectedValue(rejected);
    const env = {
      VAPID_PUBLIC_KEY: "public",
      VAPID_PRIVATE_KEY: "private",
    } as AppEnv;
    const defer = vi.fn();

    await sendPushForNotification(
      db,
      env,
      { recipientId: "u1", type: "message" },
      defer,
    );

    expect(captureServerException).toHaveBeenCalledWith(
      env,
      defer,
      rejected,
      expect.objectContaining({
        properties: expect.objectContaining({ push: "vapid rejected" }),
      }),
    );
  });
});
