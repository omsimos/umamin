import { describe, expect, it } from "vitest";
import { privateJson } from "./private-json";

describe("privateJson", () => {
  it("sets the private no-store Cache-Control and Vary: Cookie", async () => {
    const res = privateJson({ ok: true });

    expect(res.headers.get("Cache-Control")).toBe(
      "private, no-store, max-age=0",
    );
    expect(res.headers.get("Vary")).toBe("Cookie");
    expect(await res.json()).toEqual({ ok: true });
  });

  it("round-trips a complex body", async () => {
    const body = { user: "anon", count: 0, items: [1, 2, 3], flag: false };
    expect(await privateJson(body).json()).toEqual(body);
  });

  it("defaults to a 200 JSON response", async () => {
    const res = privateJson({ ok: true });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/json");
  });

  it("preserves a status passed via init", () => {
    expect(privateJson({ error: "unauthorized" }, { status: 401 }).status).toBe(
      401,
    );
  });

  it("merges init headers while still forcing the privacy headers", () => {
    const res = privateJson({ ok: true }, { headers: { "X-Custom": "v1" } });
    expect(res.headers.get("X-Custom")).toBe("v1");
    expect(res.headers.get("Cache-Control")).toBe(
      "private, no-store, max-age=0",
    );
    expect(res.headers.get("Vary")).toBe("Cookie");
  });

  it("overrides Cache-Control and Vary supplied in init headers", () => {
    const res = privateJson(
      { ok: true },
      { headers: { "Cache-Control": "public, max-age=60", Vary: "Accept" } },
    );
    expect(res.headers.get("Cache-Control")).toBe(
      "private, no-store, max-age=0",
    );
    expect(res.headers.get("Vary")).toBe("Cookie");
  });

  it("accepts a Headers instance as init headers", () => {
    const res = privateJson(
      { ok: true },
      {
        headers: new Headers({ "X-Trace": "abc" }),
      },
    );
    expect(res.headers.get("X-Trace")).toBe("abc");
    expect(res.headers.get("Cache-Control")).toBe(
      "private, no-store, max-age=0",
    );
  });
});
