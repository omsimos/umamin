import { describe, expect, it } from "vitest";
import { extractClientIp, rateLimitKeyForIp } from "../src/server-lib/ip";

const headers =
  (h: Record<string, string>) =>
  (name: string): string | undefined =>
    h[name.toLowerCase()];

describe("extractClientIp", () => {
  it("prefers cf-connecting-ip over any forwarding header", () => {
    const get = headers({
      "cf-connecting-ip": "203.0.113.9",
      "x-forwarded-for": "198.51.100.1, 10.0.0.1",
    });
    expect(extractClientIp(get, true)).toBe("203.0.113.9");
    expect(extractClientIp(get, false)).toBe("203.0.113.9");
  });

  it("ignores forwarding headers when they are not trusted (production)", () => {
    const get = headers({
      "x-forwarded-for": "198.51.100.1",
      "x-real-ip": "198.51.100.2",
    });
    expect(extractClientIp(get, false)).toBe("127.0.0.1");
  });

  it("falls back to forwarding headers only when trusted (dev / non-CF ingress)", () => {
    const get = headers({ "x-forwarded-for": "198.51.100.1, 10.0.0.1" });
    expect(extractClientIp(get, true)).toBe("198.51.100.1");
  });
});

describe("rateLimitKeyForIp", () => {
  it("collapses addresses in one /64 to a single key", () => {
    const a = rateLimitKeyForIp("2001:db8:1:2::1");
    expect(a).toBe("2001:0db8:0001:0002::/64");
    expect(rateLimitKeyForIp("2001:db8:1:2:ffff::9")).toBe(a);
  });

  it("separates different /64s", () => {
    expect(rateLimitKeyForIp("2001:db8:1:3::1")).not.toBe(
      rateLimitKeyForIp("2001:db8:1:2::1"),
    );
  });

  it("keeps IPv4 whole", () => {
    expect(rateLimitKeyForIp("203.0.113.9")).toBe("203.0.113.9");
  });

  it("keeps IPv4-mapped addresses distinct instead of merging them", () => {
    expect(rateLimitKeyForIp("::ffff:1.2.3.4")).not.toBe(
      rateLimitKeyForIp("::ffff:5.6.7.8"),
    );
  });

  it("returns malformed input unchanged", () => {
    expect(rateLimitKeyForIp("not-an-ip")).toBe("not-an-ip");
  });
});
