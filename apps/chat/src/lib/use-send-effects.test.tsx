import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ChatMessage } from "./session/types";
import { useSendEffects } from "./use-send-effects";

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

describe("useSendEffects", () => {
  it("primes the existing backlog silently (a reload must not replay)", () => {
    const { result } = renderHook(
      ({ messages }) => useSendEffects(messages, "match-1"),
      { initialProps: { messages: [msg("m1", "confetti")] } },
    );
    expect(result.current.active).toBeNull();
  });

  it("plays a newly arriving effect exactly once", () => {
    const initial = [msg("m1")];
    const { result, rerender } = renderHook(
      ({ messages }) => useSendEffects(messages, "match-1"),
      { initialProps: { messages: initial } },
    );
    rerender({ messages: [...initial, msg("m2", "hearts")] });
    expect(result.current.active).toBe("hearts");

    act(() => result.current.clear());
    expect(result.current.active).toBeNull();
    // The same message doesn't replay on a later snapshot churn.
    rerender({ messages: [...initial, msg("m2", "hearts"), msg("m3")] });
    expect(result.current.active).toBeNull();
  });

  it("re-primes when the match changes", () => {
    const { result, rerender } = renderHook(
      ({ messages, matchId }) => useSendEffects(messages, matchId),
      { initialProps: { messages: [msg("m1")], matchId: "match-1" } },
    );
    // New match: its first snapshot is backlog, even with an effect inside.
    rerender({ messages: [msg("m1", "confetti")], matchId: "match-2" });
    expect(result.current.active).toBeNull();
    rerender({
      messages: [msg("m1", "confetti"), msg("m2", "hearts")],
      matchId: "match-2",
    });
    expect(result.current.active).toBe("hearts");
  });
});
