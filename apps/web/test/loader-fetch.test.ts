import { describe, expect, it } from "vitest";
import { buildSsrHeaders, cookieHeaderHasAny } from "../src/lib/loader-fetch";
import { extractClientIp } from "../src/server-lib/ip";

describe("buildSsrHeaders", () => {
  it("forwards the credential + client-IP headers the API layer keys on", () => {
    const headers = buildSsrHeaders(
      new Headers({
        cookie: "__Host-session=abc",
        "cf-connecting-ip": "203.0.113.7",
        "x-forwarded-for": "203.0.113.7, 70.41.3.18",
        authorization: "Bearer tok",
      }),
    );

    expect(headers.get("cookie")).toBe("__Host-session=abc");
    expect(headers.get("authorization")).toBe("Bearer tok");
    // Without this the read limiter keys every SSR page load on one shared
    // fallback IP and starts 429ing the whole site.
    expect(extractClientIp((n) => headers.get(n))).toBe("203.0.113.7");
  });

  it("copies only the allowlist, not request-shape headers", () => {
    const headers = buildSsrHeaders(
      new Headers({
        cookie: "session=abc",
        accept: "text/html",
        "content-type": "text/html",
        "user-agent": "probe",
      }),
    );

    expect([...headers.keys()]).toEqual(["cookie"]);
  });

  it("omits absent headers instead of sending empty values", () => {
    const headers = buildSsrHeaders(new Headers());
    expect([...headers.keys()]).toEqual([]);
  });
});

// Gates whether a loader skips its /api/me dispatch. A false negative costs a
// round trip; a FALSE POSITIVE would only mean the request is made and the
// token validated as usual — so the risk is one-sided, but the prefix cases
// below are the ones that would silently misread the header.
describe("cookieHeaderHasAny", () => {
  const NAMES = ["__Host-session", "session"];

  it("detects the cookie among others", () => {
    expect(
      cookieHeaderHasAny("theme=dark; __Host-session=abc; _ga=1", NAMES),
    ).toBe(true);
  });

  it("is false for no header and for an unrelated one", () => {
    expect(cookieHeaderHasAny(null, NAMES)).toBe(false);
    expect(cookieHeaderHasAny("", NAMES)).toBe(false);
    expect(cookieHeaderHasAny("theme=dark", NAMES)).toBe(false);
  });

  it("does not match a longer name that starts with one", () => {
    // The renewal marker rides alongside the real cookie and carries no auth.
    expect(cookieHeaderHasAny("__Host-session_r=1730000000", NAMES)).toBe(
      false,
    );
    expect(cookieHeaderHasAny("session_r=1730000000", NAMES)).toBe(false);
  });

  it("does not match the name appearing inside another cookie's value", () => {
    expect(cookieHeaderHasAny("next=/login?from=session", NAMES)).toBe(false);
  });
});
