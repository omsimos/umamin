import { describe, expect, it } from "vitest";
import { publicJson } from "./public-json";

describe("publicJson", () => {
  it("sets the exact public Cache-Control with the s-maxage/SWR window", async () => {
    const res = publicJson({ ok: true }, 60);

    expect(res.headers.get("Cache-Control")).toBe(
      "public, max-age=0, s-maxage=60, stale-while-revalidate=60",
    );
    expect(await res.json()).toEqual({ ok: true });
  });

  it("interpolates the maxAge into both directives, including 0", async () => {
    expect(publicJson(null, 0).headers.get("Cache-Control")).toBe(
      "public, max-age=0, s-maxage=0, stale-while-revalidate=0",
    );
    expect(publicJson(null, 3600).headers.get("Cache-Control")).toBe(
      "public, max-age=0, s-maxage=3600, stale-while-revalidate=3600",
    );
  });

  it("round-trips a complex body", async () => {
    const body = { id: 1, tags: ["a", "b"], nested: { n: null } };
    expect(await publicJson(body, 10).json()).toEqual(body);
  });

  it("defaults to a 200 JSON response", async () => {
    const res = publicJson({ ok: true }, 10);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/json");
  });

  it("preserves a status passed via init", () => {
    expect(publicJson({ error: "nope" }, 30, { status: 404 }).status).toBe(404);
  });

  it("merges init headers and still sets Cache-Control", () => {
    const res = publicJson({ ok: true }, 30, {
      headers: { "X-Custom": "v1" },
    });
    expect(res.headers.get("X-Custom")).toBe("v1");
    expect(res.headers.get("Cache-Control")).toBe(
      "public, max-age=0, s-maxage=30, stale-while-revalidate=30",
    );
  });

  it("overrides a Cache-Control supplied in init headers", () => {
    const res = publicJson({ ok: true }, 90, {
      headers: { "Cache-Control": "no-cache" },
    });
    expect(res.headers.get("Cache-Control")).toBe(
      "public, max-age=0, s-maxage=90, stale-while-revalidate=90",
    );
  });

  it("accepts a Headers instance as init headers", () => {
    const res = publicJson({ ok: true }, 15, {
      headers: new Headers({ "X-Trace": "abc" }),
    });
    expect(res.headers.get("X-Trace")).toBe("abc");
    expect(res.headers.get("Cache-Control")).toBe(
      "public, max-age=0, s-maxage=15, stale-while-revalidate=15",
    );
  });
});
