import { register as registerPresence } from "@convex-dev/presence/test";
import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
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
  registerPresence(t); // deleteMatch tears down the presence room
  await t.mutation(api.match.enqueueAndMatch, self("a"));
  await t.mutation(api.match.enqueueAndMatch, self("b"));
  return t;
}

async function whispered() {
  const t = await matched();
  await t.mutation(api.chat.send, {
    ...auth("a"),
    text: "the secret",
    whisper: true,
  });
  const [msg] = await t.query(api.chat.messages, auth("a"));
  return { t, messageId: msg.id as Id<"messages"> };
}

describe("whispers", () => {
  it("hides the plaintext from the recipient until revealed", async () => {
    const { t } = await whispered();
    // Anti-leak: the recipient's payload carries no text while hidden.
    const [forB] = await t.query(api.chat.messages, auth("b"));
    expect(forB.text).toBe("");
    expect(forB.whisper).toEqual({ state: "hidden" });
    // The author keeps their own text.
    const [forA] = await t.query(api.chat.messages, auth("a"));
    expect(forA.text).toBe("the secret");
    expect(forA.whisper).toEqual({ state: "hidden" });
  });

  it("viewWhisper reveals the text to both sides with a viewedAt", async () => {
    const { t, messageId } = await whispered();
    await t.mutation(api.chat.viewWhisper, { ...auth("b"), messageId });
    const [forB] = await t.query(api.chat.messages, auth("b"));
    expect(forB.text).toBe("the secret");
    expect(forB.whisper?.state).toBe("revealed");
    expect(forB.whisper?.viewedAt).toEqual(expect.any(Number));
    const [forA] = await t.query(api.chat.messages, auth("a"));
    expect(forA.whisper?.state).toBe("revealed");
  });

  it("the author cannot trigger the reveal", async () => {
    const { t, messageId } = await whispered();
    await t.mutation(api.chat.viewWhisper, { ...auth("a"), messageId });
    const [forB] = await t.query(api.chat.messages, auth("b"));
    expect(forB.whisper).toEqual({ state: "hidden" });
    expect(forB.text).toBe("");
  });

  it("viewWhisper is idempotent — a second view keeps the original viewedAt", async () => {
    const { t, messageId } = await whispered();
    await t.mutation(api.chat.viewWhisper, { ...auth("b"), messageId });
    const [first] = await t.query(api.chat.messages, auth("b"));
    await t.mutation(api.chat.viewWhisper, { ...auth("b"), messageId });
    const [second] = await t.query(api.chat.messages, auth("b"));
    expect(second.whisper?.viewedAt).toBe(first.whisper?.viewedAt);
  });

  it("a third session cannot reveal someone else's whisper", async () => {
    const { t, messageId } = await whispered();
    await t.mutation(api.match.enqueueAndMatch, self("c"));
    await t.mutation(api.chat.viewWhisper, { ...auth("c"), messageId });
    const [forB] = await t.query(api.chat.messages, auth("b"));
    expect(forB.whisper).toEqual({ state: "hidden" });
  });

  it("burnWhisper redacts the text in the database for both sides", async () => {
    const { t, messageId } = await whispered();
    await t.mutation(api.chat.viewWhisper, { ...auth("b"), messageId });
    await t.mutation(internal.chat.burnWhisper, { messageId });
    for (const id of ["a", "b"]) {
      const [msg] = await t.query(api.chat.messages, auth(id));
      expect(msg.whisper).toEqual({ state: "burned" });
      expect(msg.text).toBe("");
    }
    // The plaintext genuinely left the database, not just the payload.
    const row = await t.run(async (ctx) => ctx.db.get(messageId));
    expect(row?.text).toBe("");
    expect(row?.burned).toBe(true);
  });

  it("burnWhisper no-ops on a deleted row", async () => {
    const { t, messageId } = await whispered();
    const matchId = (await t.query(api.chat.snapshot, auth("a")))
      .matchId as Id<"matches">;
    await t.mutation(internal.cleanup.deleteMatch, { matchId });
    await expect(
      t.mutation(internal.chat.burnWhisper, { messageId }),
    ).resolves.toBeNull();
  });

  it("a reply quoting a whisper shows a placeholder, never the text", async () => {
    const { t, messageId } = await whispered();
    await t.mutation(api.chat.send, {
      ...auth("b"),
      text: "replying to your whisper",
      replyToId: messageId,
    });
    const msgs = await t.query(api.chat.messages, auth("b"));
    expect(msgs.at(-1)?.replyTo?.text).toBe("🔥 Whisper");
    // Same for the whisper's author.
    const msgsA = await t.query(api.chat.messages, auth("a"));
    expect(msgsA.at(-1)?.replyTo?.text).toBe("🔥 Whisper");
  });
});
