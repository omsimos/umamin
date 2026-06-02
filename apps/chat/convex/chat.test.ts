import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const self = (id: string) => ({
  sessionId: id,
  alias: id,
  avatarSeed: id,
  interests: ["music"],
});

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
    await t.mutation(api.chat.send, { sessionId: "a", text: "hi" });
    const b = await t.query(api.chat.messages, { sessionId: "b" });
    expect(b.at(-1)?.text).toBe("hi");
    expect(b.at(-1)?.author).toBe("partner");
  });

  it("react toggles an emoji server-side", async () => {
    const t = await matched();
    await t.mutation(api.chat.send, { sessionId: "a", text: "hi" });
    const m1 = await t.query(api.chat.messages, { sessionId: "a" });
    const id = m1[0].id;
    await t.mutation(api.chat.react, {
      sessionId: "b",
      messageId: id,
      emoji: "❤️",
    });
    const m2 = await t.query(api.chat.messages, { sessionId: "a" });
    expect(m2[0].reactions).toContain("❤️");
    await t.mutation(api.chat.react, {
      sessionId: "b",
      messageId: id,
      emoji: "❤️",
    });
    const m3 = await t.query(api.chat.messages, { sessionId: "a" });
    expect(m3[0].reactions).not.toContain("❤️");
  });

  it("mutual stay-connected when both sides signal", async () => {
    const t = await matched();
    await t.mutation(api.chat.signalStayConnected, { sessionId: "a" });
    let a = await t.query(api.chat.snapshot, { sessionId: "a" });
    expect(a.stayConnected).toEqual({ self: true, partner: false });
    await t.mutation(api.chat.signalStayConnected, { sessionId: "b" });
    a = await t.query(api.chat.snapshot, { sessionId: "a" });
    expect(a.stayConnected).toEqual({ self: true, partner: true });
  });

  it("setTyping flips the caller's typing flag on the match (and clears it)", async () => {
    const t = await matched();
    await t.mutation(api.chat.setTyping, { sessionId: "b", typing: true });
    const typing = await t.run(async (ctx) => ctx.db.query("matches").first());
    expect(Boolean(typing?.typingA) || Boolean(typing?.typingB)).toBe(true);
    await t.mutation(api.chat.setTyping, { sessionId: "b", typing: false });
    const cleared = await t.run(async (ctx) => ctx.db.query("matches").first());
    expect(Boolean(cleared?.typingA) || Boolean(cleared?.typingB)).toBe(false);
  });

  it("returns the newest MESSAGE_CAP messages (oldest-first) once past the cap", async () => {
    const t = await matched();
    const matchId = (await t.query(api.chat.snapshot, { sessionId: "a" }))
      .matchId as Id<"matches">;
    await t.run(async (ctx) => {
      for (let i = 0; i < 150; i++) {
        await ctx.db.insert("messages", {
          matchId,
          author: "a",
          text: `m${i}`,
          reactions: [],
        });
      }
    });
    const msgs = await t.query(api.chat.messages, { sessionId: "a" });
    expect(msgs).toHaveLength(100);
    expect(msgs[0].text).toBe("m50");
    expect(msgs[msgs.length - 1].text).toBe("m149");
  });

  it("leave ends the match for the survivor", async () => {
    const t = await matched();
    await t.mutation(api.chat.leave, { sessionId: "a" });
    const b = await t.query(api.chat.snapshot, { sessionId: "b" });
    expect(b.phase).toBe("ended");
    expect(b.endedReason).toBe("partner-left");
  });
});
