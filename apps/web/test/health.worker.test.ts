import { describe, expect, it } from "vitest";
import { apiApp } from "../src/api";

describe("api (workers pool)", () => {
  it("GET /health returns { ok: true } inside workerd", async () => {
    const res = await apiApp.request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
