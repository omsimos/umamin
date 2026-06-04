import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatContent,
  formatUsername,
  generateUsernameId,
  getActionError,
  getBaseUrl,
  isAlreadyLiked,
  isAlreadyRemoved,
  isAlreadyReposted,
  isOlderThanOneYear,
  shortTimeAgo,
} from "./utils";

describe("shortTimeAgo", () => {
  // Pinned so the relative offsets below land in deterministic date-fns buckets.
  const NOW = new Date("2026-06-04T12:00:00.000Z");
  const ago = (ms: number) => new Date(NOW.getTime() - ms);
  const SECOND = 1000;
  const MINUTE = 60 * SECOND;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders 'just now' for under a minute", () => {
    expect(shortTimeAgo(ago(10 * SECOND))).toBe("just now");
  });

  it("renders minutes as Nm", () => {
    expect(shortTimeAgo(ago(5 * MINUTE))).toBe("5m");
  });

  it("renders hours as Nh", () => {
    expect(shortTimeAgo(ago(3 * HOUR))).toBe("3h");
  });

  it("renders days as Nd", () => {
    expect(shortTimeAgo(ago(4 * DAY))).toBe("4d");
  });

  it("renders months as Nmo", () => {
    expect(shortTimeAgo(ago(70 * DAY))).toBe("2mo");
  });

  it("renders years as Ny", () => {
    expect(shortTimeAgo(ago(2 * 365 * DAY))).toBe("2y");
  });

  it("accepts an ISO-string input", () => {
    expect(shortTimeAgo(ago(3 * HOUR).toISOString())).toBe("3h");
  });

  it("returns '' for an invalid date", () => {
    expect(shortTimeAgo("not a date")).toBe("");
    expect(shortTimeAgo(new Date("nope"))).toBe("");
  });
});

describe("formatUsername", () => {
  it("strips a leading %40 (encoded @)", () => {
    expect(formatUsername("%40josh")).toBe("josh");
  });

  it("passes a plain username through unchanged", () => {
    expect(formatUsername("josh")).toBe("josh");
  });

  it("does not crash on edge input", () => {
    expect(formatUsername("")).toBe("");
    // A bare "%40" splits into ["", ""], so .at(1) yields the empty string.
    expect(formatUsername("%40")).toBe("");
  });
});

describe("formatContent", () => {
  it("collapses 3+ consecutive newlines to exactly two", () => {
    expect(formatContent("a\n\n\n\nb")).toBe("a\n\nb");
  });

  it("collapses CRLF runs too", () => {
    expect(formatContent("a\r\n\r\n\r\nb")).toBe("a\n\nb");
  });

  it("trims surrounding whitespace", () => {
    expect(formatContent("  \n hello \n  ")).toBe("hello");
  });

  it("leaves a single blank line intact", () => {
    expect(formatContent("a\n\nb")).toBe("a\n\nb");
  });
});

describe("isOlderThanOneYear", () => {
  it("is true for a 2-year-old date", () => {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    expect(isOlderThanOneYear(twoYearsAgo)).toBe(true);
  });

  it("is false for now", () => {
    expect(isOlderThanOneYear(new Date())).toBe(false);
  });

  it("is false for null / undefined", () => {
    expect(isOlderThanOneYear(null)).toBe(false);
    expect(isOlderThanOneYear(undefined)).toBe(false);
  });

  it("is false for an invalid date", () => {
    expect(isOlderThanOneYear("not a date")).toBe(false);
  });
});

describe("getActionError", () => {
  it("returns the message for { error: 'x' }", () => {
    expect(getActionError({ error: "rate limited" })).toBe("rate limited");
  });

  it("returns undefined for an empty error string", () => {
    expect(getActionError({ error: "" })).toBeUndefined();
  });

  it("returns undefined for non-objects", () => {
    expect(getActionError(null)).toBeUndefined();
    expect(getActionError("error")).toBeUndefined();
    expect(getActionError(undefined)).toBeUndefined();
  });

  it("returns undefined for objects without an error field", () => {
    expect(getActionError({ ok: true })).toBeUndefined();
    // A non-string `error` is not a valid action error.
    expect(getActionError({ error: 123 })).toBeUndefined();
  });
});

describe("already-X guards", () => {
  const cases = [
    ["isAlreadyLiked", isAlreadyLiked, "alreadyLiked"],
    ["isAlreadyReposted", isAlreadyReposted, "alreadyReposted"],
    ["isAlreadyRemoved", isAlreadyRemoved, "alreadyRemoved"],
  ] as const;

  for (const [name, guard, key] of cases) {
    describe(name, () => {
      it("is true only for the exact { [key]: true } shape", () => {
        expect(guard({ [key]: true })).toBe(true);
      });

      it("is false for false / wrong / missing values", () => {
        expect(guard({ [key]: false })).toBe(false);
        // Truthy-but-not-`true` must not count.
        expect(guard({ [key]: 1 })).toBe(false);
        expect(guard({})).toBe(false);
        expect(guard(null)).toBe(false);
        expect(guard(undefined)).toBe(false);
        expect(guard("string")).toBe(false);
      });
    });
  }

  it("does not cross-match between the three guards", () => {
    expect(isAlreadyLiked({ alreadyReposted: true })).toBe(false);
    expect(isAlreadyReposted({ alreadyRemoved: true })).toBe(false);
    expect(isAlreadyRemoved({ alreadyLiked: true })).toBe(false);
  });
});

describe("getBaseUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers NEXT_PUBLIC_SITE_URL above all", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://site.example");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "prod.vercel.app");
    vi.stubEnv("VERCEL_URL", "preview.vercel.app");
    expect(getBaseUrl()).toBe("https://site.example");
  });

  it("falls back to the https-prefixed production URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "prod.vercel.app");
    vi.stubEnv("VERCEL_URL", "preview.vercel.app");
    expect(getBaseUrl()).toBe("https://prod.vercel.app");
  });

  it("falls back to the https-prefixed per-deployment URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    vi.stubEnv("VERCEL_URL", "preview.vercel.app");
    expect(getBaseUrl()).toBe("https://preview.vercel.app");
  });

  it("defaults to localhost when nothing is set", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    vi.stubEnv("VERCEL_URL", "");
    expect(getBaseUrl()).toBe("http://localhost:3000");
  });
});

describe("generateUsernameId", () => {
  it("defaults to length 12", () => {
    expect(generateUsernameId()).toHaveLength(12);
  });

  it("honors a custom length", () => {
    expect(generateUsernameId(20)).toHaveLength(20);
  });

  it("emits only lowercase alphanumeric chars", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateUsernameId()).toMatch(/^[0-9a-z]+$/);
    }
  });
});
