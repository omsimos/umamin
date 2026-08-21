import { describe, expect, it, vi } from "vitest";

const init = vi.fn();
// Incremented when the mock factory is evaluated, which vitest does on the first
// actual import of the module — so this is the signal for "posthog-js was
// requested at all", not just "init ran".
let sdkImports = 0;

vi.mock("posthog-js", () => {
  sdkImports++;
  return { default: { init, register: vi.fn(), captureException: vi.fn() } };
});

const { ERROR_TRACKING_ENABLED, captureException, initErrorTracking } =
  await import("@/lib/posthog");

// Vitest runs with `import.meta.env.PROD === false`, the same shape as
// `pnpm dev:web`. The point of these is that a non-PROD build never loads
// posthog-js at all: no init, no ingest requests, and no ~84KB chunk fetched.
describe("browser error tracking, unconfigured", () => {
  it("is off in a non-production build", () => {
    expect(ERROR_TRACKING_ENABLED).toBe(false);
  });

  it("never imports or initializes the SDK", async () => {
    initErrorTracking();
    captureException(new Error("boom"));
    // A macrotask, so a dynamic import would have settled by the assertion.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(sdkImports).toBe(0);
    expect(init).not.toHaveBeenCalled();
  });
});
