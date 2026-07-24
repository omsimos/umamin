import { describe, expect, it, vi } from "vitest";

// apiApp now transitively imports the argon2 .wasm (via actionsApp), which the
// node pool can't load — stub it like the action suites do; argon2 correctness
// is covered by argon2.worker.test.ts.
vi.mock("../src/server-lib/argon2", () => ({
  hash: async () => "$argon2id$stub",
  verify: async () => false,
}));

const { apiApp } = await import("../src/api");

describe("api", () => {
  it("GET /health returns { ok: true }", async () => {
    const res = await apiApp.request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
