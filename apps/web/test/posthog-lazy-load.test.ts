import { describe, expect, it, vi } from "vitest";

const init = vi.fn();
const register = vi.fn();
const captureException = vi.fn();
let sdkImports = 0;

vi.mock("posthog-js", () => {
  sdkImports++;
  return {
    default: { init, register, unregister: vi.fn(), captureException },
  };
});

vi.stubEnv("PROD", true);
vi.stubEnv("VITE_POSTHOG_PROJECT_TOKEN", "phc_test");

let idleTask: (() => void) | undefined;
vi.stubGlobal("requestIdleCallback", (task: () => void) => {
  idleTask = task;
});

const posthog = await import("@/lib/posthog");

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

// One sequence, because the module keeps the loaded SDK for the page's life.
describe("deferred error tracking", () => {
  it("waits for idle, then reports what happened before it loaded", async () => {
    expect(posthog.ERROR_TRACKING_ENABLED).toBe(true);

    posthog.initErrorTracking();
    posthog.registerViewer("user_123");
    const early = new ErrorEvent("error", { error: new Error("early") });
    window.dispatchEvent(early);
    await settle();

    // Neither mounting nor knowing the viewer may pull the SDK in early.
    expect(sdkImports).toBe(0);

    idleTask?.();
    await settle();

    expect(init).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledWith({ user_id: "user_123" });
    expect(captureException).toHaveBeenCalledWith(early, { buffered: true });
  });
});
