import { describe, expect, it } from "vitest";
import {
  addMonthsClamped,
  computeProUntil,
  hasUmaminPro,
} from "../src/lib/pro";

const at = (iso: string) => new Date(iso);

describe("hasUmaminPro", () => {
  const NOW = at("2026-08-07T12:00:00Z").getTime();

  it("is false for null/undefined/invalid horizons", () => {
    expect(hasUmaminPro(null, NOW)).toBe(false);
    expect(hasUmaminPro(undefined, NOW)).toBe(false);
    expect(hasUmaminPro("not a date", NOW)).toBe(false);
  });

  it("is true only while the horizon is in the future", () => {
    expect(hasUmaminPro(at("2026-08-08T00:00:00Z"), NOW)).toBe(true);
    expect(hasUmaminPro(at("2026-08-01T00:00:00Z"), NOW)).toBe(false);
    // An exactly-expired horizon is not Pro.
    expect(hasUmaminPro(new Date(NOW), NOW)).toBe(false);
  });

  it("accepts the string form JSON deserialization produces", () => {
    expect(hasUmaminPro("2027-01-01T00:00:00.000Z", NOW)).toBe(true);
  });
});

describe("addMonthsClamped", () => {
  it("adds calendar months to a mid-month date", () => {
    expect(addMonthsClamped(at("2026-01-15T08:30:00Z"), 6)).toEqual(
      at("2026-07-15T08:30:00Z"),
    );
  });

  it("clamps to the target month's last day instead of rolling over", () => {
    // Aug 31 + 6 months would roll into March via setMonth alone.
    expect(addMonthsClamped(at("2025-08-31T00:00:00Z"), 6)).toEqual(
      at("2026-02-28T00:00:00Z"),
    );
  });

  it("clamps to Feb 29 in a leap year", () => {
    expect(addMonthsClamped(at("2023-08-31T00:00:00Z"), 6)).toEqual(
      at("2024-02-29T00:00:00Z"),
    );
  });

  it("crosses year boundaries", () => {
    expect(addMonthsClamped(at("2026-11-10T00:00:00Z"), 6)).toEqual(
      at("2027-05-10T00:00:00Z"),
    );
  });
});

describe("computeProUntil", () => {
  it("is null with no purchases (or only refunded ones)", () => {
    expect(computeProUntil([])).toBeNull();
    expect(
      computeProUntil([
        {
          createdAt: at("2026-01-01T00:00:00Z"),
          refundedAt: at("2026-01-05T00:00:00Z"),
        },
      ]),
    ).toBeNull();
  });

  it("grants one term from a single purchase", () => {
    expect(
      computeProUntil([{ createdAt: at("2026-08-07T00:00:00Z") }]),
    ).toEqual(at("2027-02-07T00:00:00Z"));
  });

  it("stacks a purchase made while still active onto the current horizon", () => {
    expect(
      computeProUntil([
        { createdAt: at("2026-08-07T00:00:00Z") },
        { createdAt: at("2026-09-01T00:00:00Z") },
      ]),
    ).toEqual(at("2027-08-07T00:00:00Z"));
  });

  it("restarts from the purchase time after a lapse", () => {
    expect(
      computeProUntil([
        { createdAt: at("2024-01-01T00:00:00Z") },
        { createdAt: at("2026-08-07T00:00:00Z") },
      ]),
    ).toEqual(at("2027-02-07T00:00:00Z"));
  });

  it("re-derives the horizon when one of two purchases is refunded", () => {
    expect(
      computeProUntil([
        { createdAt: at("2026-08-07T00:00:00Z") },
        {
          createdAt: at("2026-09-01T00:00:00Z"),
          refundedAt: at("2026-09-10T00:00:00Z"),
        },
      ]),
    ).toEqual(at("2027-02-07T00:00:00Z"));
  });

  it("is order-independent (webhooks can land out of order)", () => {
    const shuffled = computeProUntil([
      { createdAt: at("2026-09-01T00:00:00Z") },
      { createdAt: at("2026-08-07T00:00:00Z") },
    ]);
    expect(shuffled).toEqual(at("2027-08-07T00:00:00Z"));
  });
});
