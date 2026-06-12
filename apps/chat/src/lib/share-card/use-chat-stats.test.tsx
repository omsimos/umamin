import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ChatMessage, SessionSnapshot } from "../session/types";
import { IDLE_SNAPSHOT } from "../session/types";
import { useChatStats } from "./use-chat-stats";

function msg(id: string, ts: number, reactions = 0): ChatMessage {
  return {
    id,
    author: "self",
    text: "x",
    ts,
    reactions: Array.from({ length: reactions }, () => ({
      emoji: "❤️",
      by: "self" as const,
    })),
  };
}

function snap(overrides: Partial<SessionSnapshot>): SessionSnapshot {
  return {
    ...IDLE_SNAPSHOT,
    matchId: "match-1",
    self: { alias: "Calm Otter", avatarSeed: "self-seed", interests: [] },
    partner: {
      alias: "Blue Fox",
      avatarSeed: "partner-seed",
      sharedInterests: ["music"],
      status: "online",
    },
    ...overrides,
  };
}

describe("useChatStats", () => {
  it("accumulates during active and freezes on ended", () => {
    const { result, rerender } = renderHook(
      ({ s }: { s: SessionSnapshot }) => useChatStats(s),
      {
        initialProps: {
          s: snap({ phase: "active", messages: [msg("m1", 10)] }),
        },
      },
    );
    expect(result.current).toBeNull(); // nothing shareable while active

    rerender({
      s: snap({
        phase: "active",
        messages: [msg("m1", 10), msg("m2", 20, 2)],
      }),
    });
    rerender({
      s: snap({
        phase: "ended",
        endedReason: "partner-left",
        messages: [msg("m1", 10), msg("m2", 20, 2)],
      }),
    });
    const stats = result.current;
    expect(stats).not.toBeNull();
    expect(stats?.messageCount).toBe(2);
    expect(stats?.reactionCount).toBe(2);
    expect(stats?.partner.alias).toBe("Blue Fox");
    expect(stats?.durationMs).toEqual(expect.any(Number));

    // Later snapshot churn while ended does not re-freeze.
    rerender({ s: snap({ phase: "ended", messages: [] }) });
    expect(result.current).toBe(stats);
  });

  it("derives duration from message spread on a reload into the grace window", () => {
    const { result } = renderHook(() =>
      useChatStats(
        snap({
          phase: "ended",
          messages: [msg("m1", 1_000), msg("m2", 61_000)],
        }),
      ),
    );
    expect(result.current?.durationMs).toBe(60_000);
  });

  it("omits duration when it cannot be derived", () => {
    const { result } = renderHook(() =>
      useChatStats(snap({ phase: "ended", messages: [msg("m1", 5)] })),
    );
    expect(result.current).not.toBeNull();
    expect(result.current?.durationMs).toBeUndefined();
  });

  it("returns null when the partner is unknown", () => {
    const { result } = renderHook(() =>
      useChatStats(snap({ phase: "ended", partner: null, messages: [] })),
    );
    expect(result.current).toBeNull();
  });

  it("includes the game tally as a receipt extra", () => {
    const { result, rerender } = renderHook(
      ({ s }: { s: SessionSnapshot }) => useChatStats(s),
      {
        initialProps: {
          s: snap({
            phase: "active",
            messages: [],
            gameTally: { rounds: 3, matched: 2 },
          }),
        },
      },
    );
    rerender({
      s: snap({
        phase: "ended",
        messages: [],
        gameTally: { rounds: 3, matched: 2 },
      }),
    });
    expect(result.current?.extras).toEqual([
      { label: "VIBE CHECK", value: "2/3 matched" },
    ]);
  });

  it("excludes game-result rows from the message count", () => {
    const messages: ChatMessage[] = [
      msg("m1", 10),
      {
        ...msg("g1", 20),
        gameResult: { cardId: "tot-coffee", selfPick: "A", partnerPick: "A" },
      },
    ];
    const { result, rerender } = renderHook(
      ({ s }: { s: SessionSnapshot }) => useChatStats(s),
      { initialProps: { s: snap({ phase: "active", messages }) } },
    );
    rerender({ s: snap({ phase: "ended", messages }) });
    expect(result.current?.messageCount).toBe(1);
  });

  it("counts messages past the window via the seen-id set", () => {
    const first = Array.from({ length: 3 }, (_, i) => msg(`a${i}`, i));
    const rotated = Array.from({ length: 3 }, (_, i) => msg(`b${i}`, 10 + i));
    const { result, rerender } = renderHook(
      ({ s }: { s: SessionSnapshot }) => useChatStats(s),
      { initialProps: { s: snap({ phase: "active", messages: first }) } },
    );
    rerender({ s: snap({ phase: "active", messages: rotated }) });
    rerender({ s: snap({ phase: "ended", messages: rotated }) });
    expect(result.current?.messageCount).toBe(6);
  });
});
