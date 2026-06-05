import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const self = (id: string) => ({
  sessionId: id,
  sessionSecret: `${id}-secret`,
  alias: id,
  avatarSeed: id,
  interests: ["music"],
});
const auth = (id: string) => ({ sessionId: id, sessionSecret: `${id}-secret` });

async function matched() {
  const t = convexTest(schema, modules);
  registerRateLimiter(t);
  await t.mutation(api.match.enqueueAndMatch, self("a"));
  await t.mutation(api.match.enqueueAndMatch, self("b"));
  return t;
}

describe("chat", () => {
  it("send appends a message visible to both", async () => {
    const t = await matched();
    await t.mutation(api.chat.send, { ...auth("a"), text: "hi" });
    const b = await t.query(api.chat.messages, auth("b"));
    expect(b.at(-1)?.text).toBe("hi");
    expect(b.at(-1)?.author).toBe("partner");
  });

  it("react attributes the emoji to the reactor and toggles it off", async () => {
    const t = await matched();
    await t.mutation(api.chat.send, { ...auth("a"), text: "hi" });
    const m1 = await t.query(api.chat.messages, auth("a"));
    const id = m1[0].id;
    await t.mutation(api.chat.react, {
      ...auth("b"),
      messageId: id,
      emoji: "❤️",
    });
    const m2 = await t.query(api.chat.messages, auth("a"));
    expect(m2[0].reactions).toEqual([{ emoji: "❤️", by: "partner" }]);
    // The reactor sees the same reaction as their own.
    const m2b = await t.query(api.chat.messages, auth("b"));
    expect(m2b[0].reactions).toEqual([{ emoji: "❤️", by: "self" }]);
    await t.mutation(api.chat.react, {
      ...auth("b"),
      messageId: id,
      emoji: "❤️",
    });
    const m3 = await t.query(api.chat.messages, auth("a"));
    expect(m3[0].reactions).toEqual([]);
  });

  it("allows reacting to your own message", async () => {
    const t = await matched();
    await t.mutation(api.chat.send, { ...auth("a"), text: "hi" });
    const [message] = await t.query(api.chat.messages, auth("a"));
    await t.mutation(api.chat.react, {
      ...auth("a"),
      messageId: message.id,
      emoji: "🔥",
    });
    const [after] = await t.query(api.chat.messages, auth("a"));
    expect(after.reactions).toEqual([{ emoji: "🔥", by: "self" }]);
  });

  it("keeps one reaction per side when both react with the same emoji", async () => {
    const t = await matched();
    await t.mutation(api.chat.send, { ...auth("a"), text: "hi" });
    const [message] = await t.query(api.chat.messages, auth("a"));
    for (const id of ["a", "b"]) {
      await t.mutation(api.chat.react, {
        ...auth(id),
        messageId: message.id,
        emoji: "❤️",
      });
    }
    const [after] = await t.query(api.chat.messages, auth("a"));
    expect(after.reactions).toHaveLength(2);
    expect(after.reactions).toContainEqual({ emoji: "❤️", by: "self" });
    expect(after.reactions).toContainEqual({ emoji: "❤️", by: "partner" });
  });

  it("rejects unsupported reaction payloads", async () => {
    const t = await matched();
    await t.mutation(api.chat.send, { ...auth("a"), text: "hi" });
    const [message] = await t.query(api.chat.messages, auth("a"));
    await expect(
      t.mutation(api.chat.react, {
        ...auth("b"),
        messageId: message.id,
        emoji: "not-an-emoji",
      }),
    ).rejects.toThrow(/Unsupported reaction/);
  });

  it("mutual stay-connected when both sides signal", async () => {
    const t = await matched();
    await t.mutation(api.chat.signalStayConnected, auth("a"));
    let a = await t.query(api.chat.snapshot, auth("a"));
    expect(a.stayConnected).toEqual({ self: true, partner: false });
    await t.mutation(api.chat.signalStayConnected, auth("b"));
    a = await t.query(api.chat.snapshot, auth("a"));
    expect(a.stayConnected).toEqual({ self: true, partner: true });
  });

  it("setTyping flips the caller's typing flag on the match (and clears it)", async () => {
    const t = await matched();
    await t.mutation(api.chat.setTyping, { ...auth("b"), typing: true });
    const typing = await t.run(async (ctx) => ctx.db.query("matches").first());
    expect(Boolean(typing?.typingA) || Boolean(typing?.typingB)).toBe(true);
    await t.mutation(api.chat.setTyping, { ...auth("b"), typing: false });
    const cleared = await t.run(async (ctx) => ctx.db.query("matches").first());
    expect(Boolean(cleared?.typingA) || Boolean(cleared?.typingB)).toBe(false);
  });

  it("rejects a mismatched session secret", async () => {
    const t = await matched();
    await expect(
      t.query(api.chat.snapshot, {
        sessionId: "a",
        sessionSecret: "wrong-secret",
      }),
    ).rejects.toThrow();
  });

  it("rejects legacy session rows without a secret", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("sessions", {
        sessionId: "legacy",
        alias: "legacy",
        avatarSeed: "legacy",
        interests: [],
        lastSeen: Date.now(),
      });
    });

    await expect(
      t.query(api.chat.snapshot, {
        sessionId: "legacy",
        sessionSecret: "new-secret",
      }),
    ).rejects.toThrow();
  });

  it("returns the newest MESSAGE_CAP messages (oldest-first) once past the cap", async () => {
    const t = await matched();
    const matchId = (await t.query(api.chat.snapshot, auth("a")))
      .matchId as Id<"matches">;
    await t.run(async (ctx) => {
      for (let i = 0; i < 150; i++) {
        await ctx.db.insert("messages", {
          matchId,
          author: "a",
          text: `m${i}`,
        });
      }
    });
    const msgs = await t.query(api.chat.messages, auth("a"));
    expect(msgs).toHaveLength(100);
    expect(msgs[0].text).toBe("m50");
    expect(msgs[msgs.length - 1].text).toBe("m149");
  });

  it("leave ends the match for the survivor", async () => {
    const t = await matched();
    await t.mutation(api.chat.leave, auth("a"));
    const b = await t.query(api.chat.snapshot, auth("b"));
    expect(b.phase).toBe("ended");
    expect(b.endedReason).toBe("partner-left");
  });
});
