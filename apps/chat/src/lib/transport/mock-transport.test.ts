import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GAME_DECKS } from "../../../convex/decks";
import type { SelfIdentity, SessionSnapshot } from "../session/types";
import { createMockTransport } from "./mock-transport";

const SELF: SelfIdentity = {
  alias: "NightOwl",
  avatarSeed: "seed",
  interests: ["music"],
};

// Deterministic timings; random() === 0 makes all picks the first element.
const opts = {
  random: () => 0,
  timings: {
    matchDelay: 1000,
    greetingDelay: 500,
    partnerReplyDelay: 500,
    typingDuration: 500,
    stayConnectedReplyDelay: 1000,
  },
};

function latest(t: ReturnType<typeof createMockTransport>): SessionSnapshot {
  return t.getSnapshot();
}

describe("mockTransport", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("starts idle", () => {
    const t = createMockTransport(opts);
    expect(latest(t).phase).toBe("idle");
  });

  it("a joinCode reports a miss once and still produces a normal match", () => {
    const t = createMockTransport(opts);
    const onInviteMiss = vi.fn();
    t.findMatch(SELF, { joinCode: "abc", onInviteMiss });
    expect(onInviteMiss).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(latest(t).phase).toBe("active");
  });

  it("findMatch goes matching then active with a partner", () => {
    const t = createMockTransport(opts);
    t.findMatch(SELF);
    expect(latest(t).phase).toBe("matching");
    expect(latest(t).self).toEqual(SELF);

    vi.advanceTimersByTime(1000);
    const s = latest(t);
    expect(s.phase).toBe("active");
    expect(s.partner).not.toBeNull();
    expect(s.partner?.sharedInterests).toContain("music");
  });

  it("notifies subscribers and stops after unsubscribe", () => {
    const t = createMockTransport(opts);
    const seen: string[] = [];
    const unsub = t.subscribe((s) => seen.push(s.phase));
    t.findMatch(SELF);
    expect(seen).toContain("matching");
    unsub();
    vi.advanceTimersByTime(1000);
    expect(seen).not.toContain("active");
  });

  it("send appends a self message then a partner reply", () => {
    const t = createMockTransport(opts);
    t.findMatch(SELF);
    vi.advanceTimersByTime(1000 + 500 + 500); // match + greeting typing + greeting msg
    const before = latest(t).messages.length;
    t.send("hello there");
    const selfMsg = latest(t).messages.at(-1);
    expect(selfMsg?.author).toBe("self");
    expect(selfMsg?.text).toBe("hello there");

    vi.advanceTimersByTime(500); // partnerReplyDelay -> typing
    expect(latest(t).partner?.status).toBe("typing");
    vi.advanceTimersByTime(500); // typingDuration -> message
    const partnerMsg = latest(t).messages.at(-1);
    expect(partnerMsg?.author).toBe("partner");
    expect(latest(t).messages.length).toBeGreaterThan(before + 1);
    expect(latest(t).partner?.status).toBe("online");
  });

  it("send with a reply target attaches a viewer-relative preview", () => {
    const t = createMockTransport(opts);
    t.findMatch(SELF);
    vi.advanceTimersByTime(1000 + 500 + 500); // match + greeting
    const greetingMsg = latest(t).messages[0];
    t.send("replying to you", { replyToId: greetingMsg.id });
    const reply = latest(t).messages.at(-1);
    expect(reply?.replyTo).toEqual({
      id: greetingMsg.id,
      author: "partner",
      text: greetingMsg.text,
    });
  });

  it("send drops an unknown reply target but keeps the message", () => {
    const t = createMockTransport(opts);
    t.findMatch(SELF);
    vi.advanceTimersByTime(1000 + 500 + 500);
    t.send("orphan reply", { replyToId: "nope" });
    const msg = latest(t).messages.at(-1);
    expect(msg?.text).toBe("orphan reply");
    expect(msg?.replyTo).toBeUndefined();
  });

  it("a sent whisper is viewed by the partner, then burns", () => {
    const t = createMockTransport(opts);
    t.findMatch(SELF);
    vi.advanceTimersByTime(1000 + 500 + 500);
    t.send("my secret", { whisper: true });
    const sent = latest(t).messages.find(
      (m) => m.author === "self" && m.whisper,
    );
    expect(sent?.text).toBe("my secret"); // sender keeps their own text
    expect(sent?.whisper).toEqual({ state: "hidden" });

    vi.advanceTimersByTime(2500); // whisperViewDelay — partner "taps" it
    const viewed = latest(t).messages.find((m) => m.id === sent?.id);
    expect(viewed?.whisper?.state).toBe("revealed");
    expect(viewed?.whisper?.viewedAt).toEqual(expect.any(Number));

    vi.advanceTimersByTime(10_000); // WHISPER_BURN_MS
    const burned = latest(t).messages.find((m) => m.id === sent?.id);
    expect(burned?.whisper).toEqual({ state: "burned" });
    expect(burned?.text).toBe("");
  });

  it("a partner whisper hides its text until viewWhisper reveals it", () => {
    const t = createMockTransport(opts);
    t.findMatch(SELF);
    vi.advanceTimersByTime(1000 + 500 + 500);
    t.send("my secret", { whisper: true });
    vi.advanceTimersByTime(500 + 500); // partner reply delay + typing
    const incoming = latest(t).messages.find(
      (m) => m.author === "partner" && m.whisper,
    );
    // Anti-leak: the snapshot never carries the plaintext while hidden.
    expect(incoming?.text).toBe("");
    expect(incoming?.whisper?.state).toBe("hidden");

    if (!incoming) throw new Error("no incoming whisper");
    t.viewWhisper(incoming.id);
    const revealed = latest(t).messages.find((m) => m.id === incoming.id);
    expect(revealed?.text).not.toBe("");
    expect(revealed?.whisper?.state).toBe("revealed");

    vi.advanceTimersByTime(10_000);
    const burned = latest(t).messages.find((m) => m.id === incoming.id);
    expect(burned?.whisper?.state).toBe("burned");
    expect(burned?.text).toBe("");
  });

  it("viewWhisper ignores own messages and non-whispers", () => {
    const t = createMockTransport(opts);
    t.findMatch(SELF);
    vi.advanceTimersByTime(1000 + 500 + 500);
    t.send("normal", {});
    const own = latest(t).messages.at(-1);
    if (!own) throw new Error("no message");
    t.viewWhisper(own.id);
    expect(latest(t).messages.at(-1)?.whisper).toBeUndefined();
  });

  it("send carries an effect on the self message", () => {
    const t = createMockTransport(opts);
    t.findMatch(SELF);
    vi.advanceTimersByTime(1000 + 500 + 500);
    t.send("party", { effect: "confetti" });
    expect(latest(t).messages.at(-1)?.effect).toBe("confetti");
  });

  it("react sets, replaces, and clears the self reaction", () => {
    const t = createMockTransport(opts);
    t.findMatch(SELF);
    vi.advanceTimersByTime(1000 + 500 + 500);
    const id = latest(t).messages[0].id;
    t.react(id, "❤️");
    expect(latest(t).messages[0].reactions).toEqual([
      { emoji: "❤️", by: "self" },
    ]);
    // One reaction per user: a different emoji replaces the previous one.
    t.react(id, "🔥");
    expect(latest(t).messages[0].reactions).toEqual([
      { emoji: "🔥", by: "self" },
    ]);
    t.react(id, "🔥");
    expect(latest(t).messages[0].reactions).toEqual([]);
  });

  it("deal exposes a round; the partner's pick stays hidden until reveal", () => {
    const t = createMockTransport(opts);
    t.findMatch(SELF);
    vi.advanceTimersByTime(1000);
    const cardId = GAME_DECKS["this-or-that"][0].id;
    t.dealCard(cardId);
    expect(latest(t).game).toEqual({
      cardId,
      dealtBy: "self",
      mode: "match",
      selfPick: null,
      partnerAnswered: false,
    });

    vi.advanceTimersByTime(1600); // gameAnswerDelay — partner picks
    // Anti-leak: partnerAnswered flips but the pick itself is withheld.
    expect(latest(t).game?.partnerAnswered).toBe(true);
    expect(latest(t).game?.partnerPick).toBeUndefined();

    t.answerCard(cardId, "A");
    const g = latest(t).game;
    expect(g?.selfPick).toBe("A");
    expect(g?.partnerPick).toBe("A"); // random()=0 -> partner picked A
    expect(latest(t).gameTally).toEqual({ rounds: 1, matched: 1 });
    // The completed round also lands in the conversation.
    expect(latest(t).messages.at(-1)?.gameResult).toEqual({
      cardId,
      selfPick: "A",
      partnerPick: "A",
      dealtBy: "self",
    });
  });

  it("answering before the partner reveals once their pick lands", () => {
    const t = createMockTransport(opts);
    t.findMatch(SELF);
    vi.advanceTimersByTime(1000);
    const cardId = GAME_DECKS["this-or-that"][0].id;
    t.dealCard(cardId);
    t.answerCard(cardId, "B");
    expect(latest(t).game?.partnerPick).toBeUndefined();
    vi.advanceTimersByTime(1600);
    expect(latest(t).game?.partnerPick).toBe("A");
    expect(latest(t).gameTally).toEqual({ rounds: 1, matched: 0 });
  });

  it("dismiss clears the round; findMatch resets the tally", () => {
    const t = createMockTransport(opts);
    t.findMatch(SELF);
    vi.advanceTimersByTime(1000);
    const cardId = GAME_DECKS["this-or-that"][0].id;
    t.dealCard(cardId);
    t.answerCard(cardId, "A");
    vi.advanceTimersByTime(1600);
    t.dismissGame();
    expect(latest(t).game).toBeNull();
    expect(latest(t).gameTally.rounds).toBe(1);

    t.findMatch(SELF);
    expect(latest(t).gameTally).toEqual({ rounds: 0, matched: 0 });
  });

  it("dealCard ignores unknown card ids", () => {
    const t = createMockTransport(opts);
    t.findMatch(SELF);
    vi.advanceTimersByTime(1000);
    t.dealCard("nope");
    expect(latest(t).game).toBeNull();
  });

  it("simulates the reveal: tease first, handles only after both are in", () => {
    const t = createMockTransport(opts);
    t.findMatch(SELF);
    vi.advanceTimersByTime(1000);
    // No-op before mutual hearts.
    t.submitRevealHandle("@too-early");
    expect(latest(t).reveal.self.submitted).toBe(false);

    t.signalStayConnected();
    vi.advanceTimersByTime(1400); // partner reciprocates
    expect(latest(t).reveal.unlocked).toBe(true);
    vi.advanceTimersByTime(2600); // partner drops a handle — withheld
    expect(latest(t).reveal.partner).toEqual({ submitted: true });

    t.submitRevealHandle("@me");
    const r = latest(t).reveal;
    expect(r.self.handle).toBe("@me");
    expect(r.partner.handle).toMatch(/^@/);
  });

  it("withdraw clears the own side pre-reveal only", () => {
    const t = createMockTransport(opts);
    t.findMatch(SELF);
    vi.advanceTimersByTime(1000);
    t.signalStayConnected();
    vi.advanceTimersByTime(1400);
    t.submitRevealHandle("@me");
    t.withdrawRevealHandle();
    expect(latest(t).reveal.self).toEqual({ submitted: false });
  });

  it("a guess round feeds guessTally and the streak, not gameTally", () => {
    const t = createMockTransport(opts);
    t.findMatch(SELF);
    vi.advanceTimersByTime(1000);
    const cardId = GAME_DECKS["this-or-that"][0].id;
    t.dealCard(cardId, "guess");
    expect(latest(t).game?.mode).toBe("guess");
    t.answerCard(cardId, "A");
    vi.advanceTimersByTime(1600); // partner predicts A (random()=0)
    expect(latest(t).guessTally).toEqual({ rounds: 1, correct: 1 });
    expect(latest(t).gameTally).toEqual({ rounds: 0, matched: 0 });
    expect(latest(t).gameStreak).toEqual({ current: 1, best: 1 });
    const row = latest(t).messages.at(-1)?.gameResult;
    expect(row?.mode).toBe("guess");
    expect(row?.dealtBy).toBe("self");
  });

  it("signalStayConnected becomes mutual after the partner reciprocates", () => {
    const t = createMockTransport(opts);
    t.findMatch(SELF);
    vi.advanceTimersByTime(1000);
    t.signalStayConnected();
    expect(latest(t).stayConnected).toEqual({ self: true, partner: false });
    vi.advanceTimersByTime(1000);
    expect(latest(t).stayConnected).toEqual({ self: true, partner: true });
  });

  it("leave ends the session and cancels pending timers", () => {
    const t = createMockTransport(opts);
    t.findMatch(SELF);
    vi.advanceTimersByTime(1000);
    t.send("hi");
    t.leave("self-ended");
    expect(latest(t).phase).toBe("ended");
    expect(latest(t).endedReason).toBe("self-ended");
    const count = latest(t).messages.length;
    vi.advanceTimersByTime(5000); // no queued partner reply should fire
    expect(latest(t).messages.length).toBe(count);
  });
});
