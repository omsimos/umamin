import { describe, expect, it } from "vitest";
import {
  computeVibe,
  EMPTY_VIBE_COUNTERS,
  MAX_VIBE_LEVEL,
  VIBE_LEVEL_THRESHOLDS,
  VIBE_MSG_COUNT_CAP,
  VIBE_REACTION_CAP,
  VIBE_WHISPER_CAP,
  type VibeInput,
  vibeProgress,
} from "./vibe";

const base: VibeInput = {
  ...EMPTY_VIBE_COUNTERS,
  rounds: 0,
  successes: 0,
  mutualStayConnected: false,
};

describe("computeVibe", () => {
  it("starts at level 1 with no score", () => {
    expect(computeVibe(base)).toEqual({ score: 0, level: 1 });
  });

  it("enters each level exactly at its threshold, not one point before", () => {
    const at: Partial<VibeInput>[] = [
      { rounds: 5 }, // 25
      { rounds: 11 }, // 55
      { msgsA: 45, msgsB: 45 }, // 90
      { msgsA: 60, msgsB: 60, reactions: 5 }, // 130
    ];
    const justBelow: Partial<VibeInput>[] = [
      { msgsA: 12, msgsB: 12 }, // 24
      { msgsA: 27, msgsB: 27 }, // 54
      { msgsA: 42, msgsB: 42, rounds: 1 }, // 89
      { msgsA: 60, msgsB: 60, reactions: 2, rounds: 1 }, // 129
    ];
    for (const [i, threshold] of VIBE_LEVEL_THRESHOLDS.slice(1).entries()) {
      const hit = computeVibe({ ...base, ...at[i] });
      expect(hit, `at ${threshold}`).toEqual({
        score: threshold,
        level: i + 2,
      });
      const miss = computeVibe({ ...base, ...justBelow[i] });
      expect(miss, `below ${threshold}`).toEqual({
        score: threshold - 1,
        level: i + 1,
      });
    }
  });

  it("a monologue fills nothing", () => {
    expect(computeVibe({ ...base, msgsA: 30 }).score).toBe(0);
  });

  it("clamps each component at its cap", () => {
    const huge = 10_000;
    expect(computeVibe({ ...base, msgsA: huge, msgsB: huge }).score).toBe(
      2 * VIBE_MSG_COUNT_CAP,
    );
    expect(computeVibe({ ...base, reactions: huge }).score).toBe(
      2 * VIBE_REACTION_CAP,
    );
    expect(computeVibe({ ...base, whispers: huge }).score).toBe(
      6 * VIBE_WHISPER_CAP,
    );
  });

  it("game grinding alone caps below the top level", () => {
    const grinder = computeVibe({ ...base, rounds: 500, successes: 500 });
    expect(grinder.score).toBe(120);
    expect(grinder.level).toBe(MAX_VIBE_LEVEL - 1);
  });

  it("mutual stay-connected adds 20", () => {
    expect(computeVibe({ ...base, mutualStayConnected: true }).score).toBe(20);
  });

  it("the top level is reachable with real two-sided engagement", () => {
    const maxed = computeVibe({
      msgsA: VIBE_MSG_COUNT_CAP,
      msgsB: VIBE_MSG_COUNT_CAP,
      reactions: VIBE_REACTION_CAP,
      whispers: VIBE_WHISPER_CAP,
      rounds: 0,
      successes: 0,
      mutualStayConnected: false,
    });
    expect(maxed.level).toBe(MAX_VIBE_LEVEL);
  });
});

describe("vibeProgress", () => {
  it("is 0 at a level's floor and approaches 1 just below the next", () => {
    const floor = VIBE_LEVEL_THRESHOLDS[1];
    const next = VIBE_LEVEL_THRESHOLDS[2];
    expect(vibeProgress(floor, 2)).toBe(0);
    expect(vibeProgress((floor + next) / 2, 2)).toBeCloseTo(0.5);
    expect(vibeProgress(next - 1, 2)).toBeLessThan(1);
  });

  it("is 1 at the top level and clamps out-of-range scores", () => {
    expect(vibeProgress(9_999, MAX_VIBE_LEVEL)).toBe(1);
    expect(vibeProgress(-5, 1)).toBe(0);
    expect(vibeProgress(VIBE_LEVEL_THRESHOLDS[2] + 100, 2)).toBe(1);
  });
});
