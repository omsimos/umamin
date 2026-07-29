import { describe, expect, it } from "vitest";
import { apiApp } from "../src/api";

// Looks like a trivial health check — it is not. This is the ONLY test that
// imports the full `apiApp` inside workerd, so it is what proves the deployed
// Worker's entire module graph instantiates on the real runtime: every route,
// every action, and the argon2 `.wasm` bundled as a CompiledWasm module. The
// node-pool suites can't cover it — they have to stub argon2 just to load. A
// dependency that only works under Node fails here and nowhere else.
describe("api module graph under workerd", () => {
  it("instantiates and serves a request", async () => {
    const res = await apiApp.request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
