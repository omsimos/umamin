import { describe, expect, it } from "vitest";
import { buildSsrHeaders } from "../src/lib/loader-fetch";
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
