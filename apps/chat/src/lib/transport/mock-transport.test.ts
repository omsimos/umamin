import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
