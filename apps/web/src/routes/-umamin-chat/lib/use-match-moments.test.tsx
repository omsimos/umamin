import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  type ChatMessage,
  IDLE_SNAPSHOT,
  type SessionSnapshot,
} from "@/lib/chat/types";
import { useMatchMoments } from "./use-match-moments";

function msg(id: string, effect?: ChatMessage["effect"]): ChatMessage {
  return {
    id,
    author: "self",
    text: "x",
    ts: 0,
    reactions: [],
    ...(effect ? { effect } : {}),
  };
}

function snap(overrides: Partial<SessionSnapshot> = {}): SessionSnapshot {
  return {
    ...IDLE_SNAPSHOT,
    phase: "active",
    matchId: "match-1",
    partner: {
      alias: "Stranger",
      avatarSeed: "p",
      sharedInterests: [],
      status: "online",
    },
    ...overrides,
  };
}

const MUTUAL = { self: true, partner: true };
const REVEALED = {
  unlocked: true,
  self: { submitted: true, handle: "me" },
  partner: { submitted: true, handle: "them" },
};

function setup(initial: SessionSnapshot) {
  const onTease = vi.fn();
  const onReveal = vi.fn();
  const hook = renderHook(
    ({ snapshot }) => useMatchMoments(snapshot, { onTease, onReveal }),
    { initialProps: { snapshot: initial } },
  );
  return { ...hook, onTease, onReveal };
}

describe("useMatchMoments", () => {
  describe("send effects", () => {
    it("primes the existing backlog silently (a reload must not replay)", () => {
      const { result } = setup(snap({ messages: [msg("m1", "confetti")] }));
      expect(result.current.effect).toBeNull();
    });

    it("plays a newly arriving effect exactly once", () => {
      const initial = [msg("m1")];
      const { result, rerender } = setup(snap({ messages: initial }));
      rerender({
        snapshot: snap({ messages: [...initial, msg("m2", "hearts")] }),
      });
      expect(result.current.effect).toBe("hearts");

      act(() => result.current.clearEffect());
      expect(result.current.effect).toBeNull();
      // The same message doesn't replay on a later snapshot churn.
      rerender({
        snapshot: snap({
          messages: [...initial, msg("m2", "hearts"), msg("m3")],
        }),
      });
      expect(result.current.effect).toBeNull();
    });

    it("re-primes when the match changes", () => {
      const { result, rerender } = setup(snap({ messages: [msg("m1")] }));
      // New match: its first snapshot is backlog, even with an effect inside.
      rerender({
        snapshot: snap({
          matchId: "match-2",
          messages: [msg("m1", "confetti")],
        }),
      });
      expect(result.current.effect).toBeNull();
      rerender({
        snapshot: snap({
          matchId: "match-2",
          messages: [msg("m1", "confetti"), msg("m2", "hearts")],
        }),
      });
      expect(result.current.effect).toBe("hearts");
    });

    it("plays an own send once, on the ack rather than the optimistic copy", () => {
      const { result, rerender } = setup(snap());
      rerender({
        snapshot: snap({
          messages: [{ ...msg("tmp-1", "confetti"), delivery: "sending" }],
        }),
      });
      expect(result.current.effect).toBeNull();
      rerender({ snapshot: snap({ messages: [msg("s-1", "confetti")] }) });
      expect(result.current.effect).toBe("confetti");
    });

    // The overlay never finishes when the chat ends under it, so the effect
    // used to stay set and play again as soon as the next match went active.
    it("drops an effect cut short by the match ending", () => {
      const { result, rerender } = setup(snap());
      rerender({ snapshot: snap({ messages: [msg("m1", "golden")] }) });
      expect(result.current.effect).toBe("golden");
      rerender({ snapshot: { ...IDLE_SNAPSHOT, phase: "matching" } });
      rerender({ snapshot: snap({ matchId: "match-2" }) });
      expect(result.current.effect).toBeNull();
    });
  });

  describe("celebration", () => {
    it("celebrates when the chat turns mutual", () => {
      const { result, rerender } = setup(snap());
      expect(result.current.overlay).toBeNull();
      rerender({ snapshot: snap({ stayConnected: MUTUAL }) });
      expect(result.current.overlay).toBe("celebration");
      act(() => result.current.closeOverlay());
      expect(result.current.overlay).toBeNull();
      rerender({ snapshot: snap({ stayConnected: { ...MUTUAL } }) });
      expect(result.current.overlay).toBeNull();
    });

    it("doesn't celebrate again after a reload into a mutual chat", () => {
      const { result, rerender } = setup(snap({ stayConnected: MUTUAL }));
      rerender({
        snapshot: snap({ stayConnected: MUTUAL, messages: [msg("m1")] }),
      });
      expect(result.current.overlay).toBeNull();
    });

    it("gives way to the reveal instead of stacking with it", () => {
      const { result, rerender, onReveal } = setup(snap());
      rerender({ snapshot: snap({ stayConnected: MUTUAL }) });
      expect(result.current.overlay).toBe("celebration");
      rerender({ snapshot: snap({ stayConnected: MUTUAL, reveal: REVEALED }) });
      expect(result.current.overlay).toBe("reveal");
      expect(onReveal).toHaveBeenCalledTimes(1);
    });
  });

  describe("reveal", () => {
    it("teases once when the partner submits first", () => {
      const { rerender, onTease } = setup(snap({ stayConnected: MUTUAL }));
      const partnerFirst = {
        unlocked: true,
        self: { submitted: false },
        partner: { submitted: true },
      };
      rerender({
        snapshot: snap({ stayConnected: MUTUAL, reveal: partnerFirst }),
      });
      rerender({
        snapshot: snap({
          stayConnected: MUTUAL,
          reveal: partnerFirst,
          messages: [msg("m1")],
        }),
      });
      expect(onTease).toHaveBeenCalledTimes(1);
      expect(onTease).toHaveBeenCalledWith("Stranger");
    });

    it("doesn't replay the reveal after a reload", () => {
      const { result, rerender, onReveal } = setup(
        snap({ stayConnected: MUTUAL, reveal: REVEALED }),
      );
      rerender({
        snapshot: snap({
          stayConnected: MUTUAL,
          reveal: REVEALED,
          messages: [msg("m1")],
        }),
      });
      expect(result.current.overlay).toBeNull();
      expect(onReveal).not.toHaveBeenCalled();
    });
  });

  it("resets every moment together when the match changes", () => {
    const { result, rerender } = setup(snap());
    act(() => result.current.dismissIceBreaker());
    rerender({ snapshot: snap({ stayConnected: MUTUAL }) });
    expect(result.current.iceBreakerDismissed).toBe(true);
    expect(result.current.overlay).toBe("celebration");
    rerender({ snapshot: snap({ matchId: "match-2" }) });
    expect(result.current.iceBreakerDismissed).toBe(false);
    expect(result.current.overlay).toBeNull();
  });
});
