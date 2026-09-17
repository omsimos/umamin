import { describe, expect, it } from "vitest";
import { extractClientIp } from "../src/server-lib/ip";

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
