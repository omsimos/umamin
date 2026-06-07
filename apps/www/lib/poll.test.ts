import { describe, expect, it } from "vitest";
import {
  isPollEnded,
  POLL_MAX_OPTIONS,
  POLL_OPTION_MAX_LENGTH,
  pollEndsAtFrom,
  pollPercentages,
  pollTotalVotes,
  sanitizePollOptions,
} from "./poll";

const NOW = new Date("2026-06-07T12:00:00.000Z").getTime();
const HOUR = 60 * 60 * 1000;

describe("pollEndsAtFrom", () => {
  it("maps each preset to its exact duration", () => {
    expect(pollEndsAtFrom("1h", NOW).getTime()).toBe(NOW + HOUR);
    expect(pollEndsAtFrom("6h", NOW).getTime()).toBe(NOW + 6 * HOUR);
    expect(pollEndsAtFrom("1d", NOW).getTime()).toBe(NOW + 24 * HOUR);
    expect(pollEndsAtFrom("3d", NOW).getTime()).toBe(NOW + 72 * HOUR);
    expect(pollEndsAtFrom("7d", NOW).getTime()).toBe(NOW + 168 * HOUR);
  });
});

describe("isPollEnded", () => {
  it("is open strictly before endsAt and ended at the boundary", () => {
    const endsAt = new Date(NOW + HOUR);
    expect(isPollEnded(endsAt, NOW)).toBe(false);
    expect(isPollEnded(endsAt, NOW + HOUR)).toBe(true);
    expect(isPollEnded(endsAt, NOW + HOUR + 1)).toBe(true);
  });

  it("accepts ISO strings (the JSON round-trip shape)", () => {
    expect(isPollEnded(new Date(NOW + HOUR).toISOString(), NOW)).toBe(false);
    expect(isPollEnded(new Date(NOW - 1).toISOString(), NOW)).toBe(true);
  });

  it("treats missing or invalid dates as ended", () => {
    expect(isPollEnded(null, NOW)).toBe(true);
    expect(isPollEnded(undefined, NOW)).toBe(true);
    expect(isPollEnded("not-a-date", NOW)).toBe(true);
  });
});

describe("sanitizePollOptions", () => {
  it("trims entries and drops empty ones", () => {
    expect(sanitizePollOptions(["  yes  ", "", "   ", "no"])).toEqual([
      "yes",
      "no",
    ]);
  });

  it("dedupes case-insensitively, keeping the first casing", () => {
    expect(sanitizePollOptions(["Yes", "yes", "NO", "no"])).toEqual([
      "Yes",
      "NO",
    ]);
  });

  it("drops non-string entries", () => {
    expect(sanitizePollOptions(["a", 1, null, {}, "b"])).toEqual(["a", "b"]);
  });

  it("caps label length and re-trims after truncation", () => {
    const long = "x".repeat(POLL_OPTION_MAX_LENGTH + 10);
    const [first] = sanitizePollOptions([long, "other"]);
    expect(first).toHaveLength(POLL_OPTION_MAX_LENGTH);

    const padded = `${"x".repeat(POLL_OPTION_MAX_LENGTH - 1)} y`;
    const [trimmed] = sanitizePollOptions([padded, "other"]);
    expect(trimmed).toBe("x".repeat(POLL_OPTION_MAX_LENGTH - 1));
  });

  it("caps at the max option count", () => {
    expect(sanitizePollOptions(["a", "b", "c", "d", "e"])).toHaveLength(
      POLL_MAX_OPTIONS,
    );
  });

  it("returns [] when fewer than the minimum survive", () => {
    expect(sanitizePollOptions(["only one"])).toEqual([]);
    expect(sanitizePollOptions(["dup", "DUP"])).toEqual([]);
    expect(sanitizePollOptions([])).toEqual([]);
    expect(sanitizePollOptions("not-an-array")).toEqual([]);
  });
});

describe("pollTotalVotes", () => {
  it("sums counts, clamping negatives", () => {
    expect(
      pollTotalVotes([{ voteCount: 3 }, { voteCount: 0 }, { voteCount: -2 }]),
    ).toBe(3);
  });
});

describe("pollPercentages", () => {
  it("returns zeros for a zero-vote poll", () => {
    expect(pollPercentages([{ voteCount: 0 }, { voteCount: 0 }])).toEqual([
      0, 0,
    ]);
  });

  it("sums to exactly 100 on uneven splits", () => {
    const thirds = pollPercentages([
      { voteCount: 1 },
      { voteCount: 1 },
      { voteCount: 1 },
    ]);
    expect(thirds.reduce((a, b) => a + b, 0)).toBe(100);
    // Largest-remainder with index-stable ties: first option gets the point.
    expect(thirds).toEqual([34, 33, 33]);
  });

  it("handles a single landslide option", () => {
    expect(pollPercentages([{ voteCount: 5 }, { voteCount: 0 }])).toEqual([
      100, 0,
    ]);
  });

  it("is deterministic across calls", () => {
    const options = [{ voteCount: 2 }, { voteCount: 3 }, { voteCount: 2 }];
    expect(pollPercentages(options)).toEqual(pollPercentages(options));
    expect(pollPercentages(options).reduce((a, b) => a + b, 0)).toBe(100);
  });
});
