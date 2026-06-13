import { describe, expect, it, vi } from "vitest";
import {
  AURA_MIN_ACCOUNT_AGE_MS,
  AURA_POINTS,
  awardAura,
  isAuraEligibleActor,
  reverseAura,
} from "./points";

type Tx = Parameters<typeof awardAura>[0];

// Mocks the tx.update(...).set(...).where(...).returning(...) chain, capturing
// whether a write was issued and returning canned rows.
function mockTx(rows: { username: string }[]) {
  const returning = vi.fn(async () => rows);
  const where = vi.fn(() => ({ returning }));
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));
  return { tx: { update } as unknown as Tx, update };
}

// Anchored to the real clock: awardAura/reverseAura call isAuraEligibleActor
// with the live Date.now(), so the actor dates must be relative to it.
const NOW = Date.now();
const OLD = new Date(NOW - AURA_MIN_ACCOUNT_AGE_MS - 1000);
const FRESH = new Date(NOW - 1000);

describe("AURA_POINTS", () => {
  it("are all positive integers", () => {
    for (const value of Object.values(AURA_POINTS)) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
    }
  });
});

describe("isAuraEligibleActor", () => {
  it("is false for unknown age (null/undefined)", () => {
    expect(isAuraEligibleActor(null, NOW)).toBe(false);
    expect(isAuraEligibleActor(undefined, NOW)).toBe(false);
  });

  it("is false for accounts younger than the gate", () => {
    expect(isAuraEligibleActor(FRESH, NOW)).toBe(false);
  });

  it("is true at and beyond the gate boundary", () => {
    expect(
      isAuraEligibleActor(new Date(NOW - AURA_MIN_ACCOUNT_AGE_MS), NOW),
    ).toBe(true);
    expect(isAuraEligibleActor(OLD, NOW)).toBe(true);
  });
});

describe("awardAura", () => {
  it("no-ops (zero writes) on self-interaction", async () => {
    const { tx, update } = mockTx([{ username: "alice" }]);
    const result = await awardAura(tx, {
      beneficiaryId: "u1",
      actorId: "u1",
      actorCreatedAt: OLD,
      delta: AURA_POINTS.like,
    });
    expect(result).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it("no-ops (zero writes) for an under-age actor", async () => {
    const { tx, update } = mockTx([{ username: "alice" }]);
    const result = await awardAura(tx, {
      beneficiaryId: "u2",
      actorId: "u1",
      actorCreatedAt: FRESH,
      delta: AURA_POINTS.like,
    });
    expect(result).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it("no-ops for a non-positive delta", async () => {
    const { tx, update } = mockTx([{ username: "alice" }]);
    expect(
      await awardAura(tx, {
        beneficiaryId: "u2",
        actorId: "u1",
        actorCreatedAt: OLD,
        delta: 0,
      }),
    ).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it("awards and returns the beneficiary username when eligible", async () => {
    const { tx, update } = mockTx([{ username: "alice" }]);
    const result = await awardAura(tx, {
      beneficiaryId: "u2",
      actorId: "u1",
      actorCreatedAt: OLD,
      delta: AURA_POINTS.follow,
    });
    expect(result).toBe("alice");
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("returns null when the write matches no row (block guard tripped)", async () => {
    const { tx, update } = mockTx([]);
    const result = await awardAura(tx, {
      beneficiaryId: "u2",
      actorId: "u1",
      actorCreatedAt: OLD,
      delta: AURA_POINTS.like,
    });
    expect(result).toBeNull();
    expect(update).toHaveBeenCalledTimes(1);
  });
});

describe("reverseAura", () => {
  it("no-ops (zero writes) on self-interaction", async () => {
    const { tx, update } = mockTx([{ username: "alice" }]);
    const result = await reverseAura(tx, {
      beneficiaryId: "u1",
      actorId: "u1",
      actorCreatedAt: OLD,
      delta: AURA_POINTS.like,
    });
    expect(result).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it("no-ops (zero writes) for an under-age actor (mirrors award)", async () => {
    const { tx, update } = mockTx([{ username: "alice" }]);
    const result = await reverseAura(tx, {
      beneficiaryId: "u2",
      actorId: "u1",
      actorCreatedAt: FRESH,
      delta: AURA_POINTS.like,
    });
    expect(result).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it("reverses and returns the beneficiary username when eligible", async () => {
    const { tx, update } = mockTx([{ username: "bob" }]);
    const result = await reverseAura(tx, {
      beneficiaryId: "u2",
      actorId: "u1",
      actorCreatedAt: OLD,
      delta: AURA_POINTS.follow,
    });
    expect(result).toBe("bob");
    expect(update).toHaveBeenCalledTimes(1);
  });
});
