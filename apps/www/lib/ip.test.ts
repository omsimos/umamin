import { describe, expect, it } from "vitest";
import { canonicalizeIp, extractClientIp } from "./ip";

function fromMap(headers: Record<string, string | undefined>) {
  return (name: string) => headers[name] ?? null;
}

describe("extractClientIp", () => {
  it("prefers the non-spoofable x-real-ip over the forwarded headers", () => {
    expect(
      extractClientIp(
        fromMap({
          "x-real-ip": "1.1.1.1",
          "x-vercel-forwarded-for": "2.2.2.2",
          "x-forwarded-for": "3.3.3.3",
        }),
      ),
    ).toBe("1.1.1.1");
  });

  it("falls back to the first entry of x-vercel-forwarded-for, then x-forwarded-for", () => {
    expect(
      extractClientIp(
        fromMap({ "x-vercel-forwarded-for": "2.2.2.2, 9.9.9.9" }),
      ),
    ).toBe("2.2.2.2");
    expect(
      extractClientIp(fromMap({ "x-forwarded-for": "3.3.3.3, 9.9.9.9" })),
    ).toBe("3.3.3.3");
  });

  it("trims surrounding whitespace", () => {
    expect(extractClientIp(fromMap({ "x-real-ip": "  4.4.4.4  " }))).toBe(
      "4.4.4.4",
    );
  });

  it("defaults to 127.0.0.1 when no IP header is present", () => {
    expect(extractClientIp(fromMap({}))).toBe("127.0.0.1");
  });
});

describe("canonicalizeIp", () => {
  it("leaves IPv4 untouched (lowercased/trimmed)", () => {
    expect(canonicalizeIp("1.2.3.4")).toBe("1.2.3.4");
    expect(canonicalizeIp("  1.2.3.4 ")).toBe("1.2.3.4");
  });

  it("collapses equivalent IPv6 forms to one canonical key", () => {
    const expanded = "2001:0db8:0000:0000:0000:0000:0000:0001";
    expect(canonicalizeIp("2001:db8::1")).toBe(expanded);
    expect(canonicalizeIp("2001:DB8::1")).toBe(expanded);
    expect(canonicalizeIp("2001:0db8::0001")).toBe(expanded);
    expect(canonicalizeIp(expanded)).toBe(expanded);
  });

  it("canonicalizes loopback and all-zeros", () => {
    expect(canonicalizeIp("::1")).toBe(
      "0000:0000:0000:0000:0000:0000:0000:0001",
    );
    expect(canonicalizeIp("::")).toBe(
      "0000:0000:0000:0000:0000:0000:0000:0000",
    );
  });

  it("strips a zone id and expands IPv4-mapped addresses", () => {
    expect(canonicalizeIp("fe80::1%eth0")).toBe(
      "fe80:0000:0000:0000:0000:0000:0000:0001",
    );
    expect(canonicalizeIp("::ffff:1.2.3.4")).toBe(
      "0000:0000:0000:0000:0000:ffff:0102:0304",
    );
  });
});
