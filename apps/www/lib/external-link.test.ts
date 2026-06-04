import { describe, expect, it } from "vitest";
import {
  analyzeExternalUrl,
  type LinkRisk,
  RISK_LABELS,
} from "./external-link";

describe("analyzeExternalUrl", () => {
  it("returns the hostname with no risks for a clean https domain", () => {
    expect(analyzeExternalUrl("https://example.com/path")).toEqual({
      hostname: "example.com",
      risks: [],
    });
  });

  it("flags http:// as insecure", () => {
    const info = analyzeExternalUrl("http://example.com/path");
    expect(info?.risks).toContain("insecure");
  });

  it("flags a raw IPv4 host as ip (and insecure over http)", () => {
    const info = analyzeExternalUrl("http://192.168.0.1/x");
    expect(info?.risks).toContain("ip");
    expect(info?.risks).toContain("insecure");
  });

  it("flags an IPv6 host as ip via the colon check", () => {
    const info = analyzeExternalUrl("https://[2001:db8::1]/");
    expect(info?.risks).toContain("ip");
  });

  it("flags a punycode (xn--) label", () => {
    const info = analyzeExternalUrl("https://xn--e1afmkfd.example/");
    expect(info?.risks).toContain("punycode");
  });

  it("flags a known shortener", () => {
    const info = analyzeExternalUrl("https://bit.ly/x");
    expect(info?.risks).toContain("shortener");
  });

  it("flags a shortener after stripping a leading www.", () => {
    const info = analyzeExternalUrl("https://www.bit.ly/x");
    expect(info?.risks).toContain("shortener");
  });

  it("does not flag a non-shortener domain as a shortener", () => {
    const info = analyzeExternalUrl("https://example.com/x");
    expect(info?.risks).not.toContain("shortener");
  });

  it("returns null for a non-URL string", () => {
    expect(analyzeExternalUrl("not a url")).toBeNull();
  });

  it("lowercases the hostname", () => {
    const info = analyzeExternalUrl("https://EXAMPLE.COM/Path");
    expect(info?.hostname).toBe("example.com");
  });
});

describe("RISK_LABELS", () => {
  it("has a non-empty label for every LinkRisk value", () => {
    const risks: LinkRisk[] = ["shortener", "insecure", "ip", "punycode"];
    for (const risk of risks) {
      expect(RISK_LABELS[risk]).toBeTruthy();
      expect(typeof RISK_LABELS[risk]).toBe("string");
    }
  });
});
