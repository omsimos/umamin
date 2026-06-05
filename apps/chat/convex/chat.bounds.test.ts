import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { ALLOWED_REACTIONS, MAX_MESSAGE_LEN } from "./constants";
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

const countMessages = (t: ReturnType<typeof convexTest>) =>
  t.run(async (ctx) => (await ctx.db.query("messages").collect()).length);

describe("chat.send server-side bounding", () => {
  it("rejects a message longer than MAX_MESSAGE_LEN and stores nothing", async () => {
    const t = await matched();
    await expect(
      t.mutation(api.chat.send, {
        ...auth("a"),
        text: "x".repeat(MAX_MESSAGE_LEN + 1),
      }),
    ).rejects.toThrow(/too long/i);
    expect(await countMessages(t)).toBe(0);
  });

  it("accepts a message exactly at the cap (boundary is inclusive)", async () => {
    const t = await matched();
    const text = "x".repeat(MAX_MESSAGE_LEN);
    await t.mutation(api.chat.send, { ...auth("a"), text });
    const msgs = await t.query(api.chat.messages, auth("a"));
    expect(msgs.at(-1)?.text).toBe(text);
  });

  it("measures the cap after trimming — whitespace padding does not push it over", async () => {
    const t = await matched();
    const padded = `  ${"x".repeat(MAX_MESSAGE_LEN)}  `;
    await t.mutation(api.chat.send, { ...auth("a"), text: padded });
    const msgs = await t.query(api.chat.messages, auth("a"));
    expect(msgs.at(-1)?.text).toBe("x".repeat(MAX_MESSAGE_LEN));
  });

  it("trims surrounding whitespace before storing", async () => {
    const t = await matched();
    await t.mutation(api.chat.send, { ...auth("a"), text: "  hello  " });
    const msgs = await t.query(api.chat.messages, auth("a"));
    expect(msgs.at(-1)?.text).toBe("hello");
  });

  it("ignores empty / whitespace-only text as a no-op", async () => {
    const t = await matched();
    await t.mutation(api.chat.send, { ...auth("a"), text: "   " });
    await t.mutation(api.chat.send, { ...auth("a"), text: "" });
    expect(await countMessages(t)).toBe(0);
  });

  it("silently no-ops when the sender has no active match", async () => {
    const t = convexTest(schema, modules);
    registerRateLimiter(t);
    // Session exists but was never matched.
    await t.mutation(api.match.enqueueAndMatch, self("a"));
    await t.mutation(api.chat.send, { ...auth("a"), text: "into the void" });
    expect(await countMessages(t)).toBe(0);
  });
});

describe("chat.react server-side bounding", () => {
  it("keeps one reaction per participant — a new emoji replaces the previous", async () => {
    const t = await matched();
    await t.mutation(api.chat.send, { ...auth("a"), text: "hi" });
    const [message] = await t.query(api.chat.messages, auth("a"));

    // Cycling through every allowed emoji leaves only the last one standing.
    for (const emoji of ALLOWED_REACTIONS) {
      await t.mutation(api.chat.react, {
        ...auth("a"),
        messageId: message.id,
        emoji,
      });
    }
    const [after] = await t.query(api.chat.messages, auth("a"));
    expect(after.reactions).toEqual([
      { emoji: ALLOWED_REACTIONS.at(-1), by: "self" },
    ]);
  });

  it("ignores a reaction targeting a message outside the caller's match", async () => {
    const t = await matched();
    await t.mutation(api.chat.send, { ...auth("a"), text: "hi" });
    const [message] = await t.query(api.chat.messages, auth("a"));

    // A third session with no match cannot react to the pair's message.
    await t.mutation(api.match.enqueueAndMatch, self("c"));
    await t.mutation(api.chat.react, {
      ...auth("c"),
      messageId: message.id,
      emoji: "❤️",
    });
    const after = await t.query(api.chat.messages, auth("a"));
    expect(after[0].reactions).toEqual([]);
  });
});
