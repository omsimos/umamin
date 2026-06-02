import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
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
    const b = await t.query(api.chat.snapshot, { sessionId: "b" });
    expect(b.messages.at(-1)?.text).toBe("hi");
    expect(b.messages.at(-1)?.author).toBe("partner");
  });

  it("react toggles an emoji server-side", async () => {
    const t = await matched();
    await t.mutation(api.chat.send, { sessionId: "a", text: "hi" });
    const a1 = await t.query(api.chat.snapshot, { sessionId: "a" });
    const id = a1.messages[0].id;
    await t.mutation(api.chat.react, {
      sessionId: "b",
      messageId: id,
      emoji: "❤️",
    });
    const a2 = await t.query(api.chat.snapshot, { sessionId: "a" });
    expect(a2.messages[0].reactions).toContain("❤️");
    await t.mutation(api.chat.react, {
      sessionId: "b",
      messageId: id,
      emoji: "❤️",
    });
    const a3 = await t.query(api.chat.snapshot, { sessionId: "a" });
    expect(a3.messages[0].reactions).not.toContain("❤️");
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

  it("leave ends the match for the survivor", async () => {
    const t = await matched();
    await t.mutation(api.chat.leave, { sessionId: "a" });
    const b = await t.query(api.chat.snapshot, { sessionId: "b" });
    expect(b.phase).toBe("ended");
    expect(b.endedReason).toBe("partner-left");
  });
});
