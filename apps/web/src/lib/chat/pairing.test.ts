import { describe, expect, it } from "vitest";
import {
  FALLBACK_MS,
  MAX_ALIAS_LEN,
  MAX_AVATAR_SEED_LEN,
  MAX_INTEREST_LEN,
  MAX_INTERESTS,
  MAX_INVITE_CODE_LEN,
} from "./constants";
import {
  type Joiner,
  newWaiter,
  nextFallbackAt,
  normalizeCode,
  normalizeIdentity,
  pickFallbackPairs,
  pickPartner,
  type Waiter,
} from "./pairing";

const joiner = (
  sessionId: string,
  interests: string[] = ["music"],
  joinCode: string | null = null,
): Joiner => ({
  sessionId,
  secretHash: `${sessionId}-hash`,
  interests,
  joinCode,
});

const waiter = (
  sessionId: string,
  enqueuedAt: number,
  interests: string[] = ["music"],
): Waiter =>
  newWaiter(joiner(sessionId, interests), `${sessionId}-code`, enqueuedAt);

const ids = (pairs: [Waiter, Waiter][]) =>
  pairs.map(([x, y]) => [x.sessionId, y.sessionId]);

describe("newWaiter", () => {
  it("stamps the server-derived invite code, the secret hash and the fallback deadline", () => {
    expect(newWaiter(joiner("a"), "code-a", 1000)).toEqual({
      sessionId: "a",
      secretHash: "a-hash",
      interests: ["music"],
      inviteCode: "code-a",
      enqueuedAt: 1000,
      fallbackAt: 1000 + FALLBACK_MS,
    });
  });
});

describe("pickPartner", () => {
  it("queues the first user (no partner yet)", () => {
    expect(pickPartner([], joiner("a"))).toBeNull();
  });

  it("pairs with the oldest waiter sharing an interest", () => {
    const pool = [
      waiter("young", 300),
      waiter("other", 100, ["movies"]),
      waiter("old", 200),
    ];
    expect(pickPartner(pool, joiner("me"))).toEqual({
      partner: pool[2],
      viaInvite: false,
    });
  });

  it("queues when nobody shares an interest", () => {
    const pool = [waiter("x", 1, ["movies"])];
    expect(pickPartner(pool, joiner("me", ["music"]))).toBeNull();
    expect(pickPartner(pool, joiner("me", []))).toBeNull();
  });

  it("never pairs a session with itself", () => {
    expect(pickPartner([waiter("me", 1)], joiner("me"))).toBeNull();
  });

  it("an invite code lands on its host, beating an older interest match", () => {
    const pool = [waiter("older", 1), waiter("host", 2, ["movies"])];
    expect(
      pickPartner(pool, joiner("visitor", ["music"], "host-code")),
    ).toEqual({ partner: pool[1], viaInvite: true });
  });

  it("an unknown code falls back to the interest flow", () => {
    const pool = [waiter("a", 1)];
    expect(pickPartner(pool, joiner("b", ["music"], "no-such-code"))).toEqual({
      partner: pool[0],
      viaInvite: false,
    });
  });

  it("your own code is ignored rather than matching you with yourself", () => {
    const pool = [waiter("host", 1)];
    expect(
      pickPartner(pool, joiner("host", ["music"], "host-code")),
    ).toBeNull();
  });
});

describe("pickFallbackPairs", () => {
  it("only waiters whose fallback time passed start a pair", () => {
    const pool = [waiter("a", 0, ["x"]), waiter("b", 1000, ["y"])];
    expect(pickFallbackPairs(pool, FALLBACK_MS - 1)).toEqual([]);
    expect(ids(pickFallbackPairs(pool, FALLBACK_MS))).toEqual([["a", "b"]]);
  });

  it("ignores interests and pairs oldest-first into disjoint pairs", () => {
    const pool = [
      waiter("d", 30, ["4"]),
      waiter("b", 10, ["2"]),
      waiter("e", 40, ["5"]),
      waiter("a", 0, ["1"]),
      waiter("c", 20, ["3"]),
    ];
    const pairs = pickFallbackPairs(pool, 10 * FALLBACK_MS);
    expect(ids(pairs)).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("a lone waiter is never paired", () => {
    expect(pickFallbackPairs([waiter("a", 0)], 10 * FALLBACK_MS)).toEqual([]);
  });
});

describe("nextFallbackAt", () => {
  it("is null with fewer than two waiters", () => {
    expect(nextFallbackAt([])).toBeNull();
    expect(nextFallbackAt([waiter("a", 0)])).toBeNull();
  });

  it("is the earliest fallback deadline in the pool", () => {
    const pool = [waiter("a", 500), waiter("b", 100), waiter("c", 900)];
    expect(nextFallbackAt(pool)).toBe(100 + FALLBACK_MS);
  });
});

describe("normalizeIdentity", () => {
  const ok = { alias: "a", avatarSeed: "seed", interests: ["music"] };

  it("trims, defaults a blank alias and dedupes interests", () => {
    expect(
      normalizeIdentity({
        alias: "  ",
        avatarSeed: " seed ",
        interests: [" music ", "music", " "],
      }),
    ).toEqual({ alias: "Anonymous", avatarSeed: "seed", interests: ["music"] });
  });

  it("rejects an empty avatarSeed after trim", () => {
    expect(normalizeIdentity({ ...ok, avatarSeed: "   " })).toBeNull();
  });

  it("bounds the alias, inclusive at MAX_ALIAS_LEN", () => {
    const alias = "x".repeat(MAX_ALIAS_LEN);
    expect(normalizeIdentity({ ...ok, alias })?.alias).toBe(alias);
    expect(normalizeIdentity({ ...ok, alias: `${alias}x` })).toBeNull();
  });

  it("rejects an avatarSeed longer than MAX_AVATAR_SEED_LEN", () => {
    expect(
      normalizeIdentity({
        ...ok,
        avatarSeed: "x".repeat(MAX_AVATAR_SEED_LEN + 1),
      }),
    ).toBeNull();
  });

  it("caps distinct interests, counting after dedup", () => {
    const distinct = Array.from({ length: MAX_INTERESTS }, (_, i) => `i${i}`);
    expect(
      normalizeIdentity({ ...ok, interests: [...distinct, ...distinct] })
        ?.interests,
    ).toHaveLength(MAX_INTERESTS);
    expect(
      normalizeIdentity({ ...ok, interests: [...distinct, "one-more"] }),
    ).toBeNull();
  });

  it("bounds each interest after trimming", () => {
    const value = "x".repeat(MAX_INTEREST_LEN);
    expect(
      normalizeIdentity({ ...ok, interests: [`  ${value}  `] })?.interests,
    ).toEqual([value]);
    expect(
      normalizeIdentity({ ...ok, interests: ["music", `${value}x`] }),
    ).toBeNull();
  });
});

describe("normalizeCode", () => {
  it("treats a missing, empty or blank code as absent", () => {
    expect(normalizeCode(undefined)).toBeNull();
    expect(normalizeCode("")).toBeNull();
    expect(normalizeCode("   ")).toBeNull();
  });

  it("trims and accepts a code up to MAX_INVITE_CODE_LEN", () => {
    const code = "x".repeat(MAX_INVITE_CODE_LEN);
    expect(normalizeCode(` ${code} `)).toBe(code);
  });

  it("returns undefined (reject) for an over-long code", () => {
    expect(normalizeCode("x".repeat(MAX_INVITE_CODE_LEN + 1))).toBeUndefined();
  });
});
