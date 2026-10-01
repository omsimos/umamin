import { describe, expect, it, vi } from "vitest";

const init = vi.fn();
// Incremented when the mock factory is evaluated, which vitest does on the first
// actual import of the module — so this is the signal for "posthog-js was
// requested at all", not just "init ran".
let sdkImports = 0;

vi.mock("posthog-js", () => {
  sdkImports++;
  return {
    default: {
      init,
      register: vi.fn(),
      unregister: vi.fn(),
      captureException: vi.fn(),
    },
  };
});

const {
  ERROR_TRACKING_ENABLED,
  captureException,
  dropBenignExceptions,
  initErrorTracking,
  registerViewer,
} = await import("@/lib/posthog");

// Vitest runs with `import.meta.env.PROD === false`, the same shape as
// `pnpm dev:web`. The point of these is that a non-PROD build never loads
// posthog-js at all: no init, no ingest requests, and no ~84KB chunk fetched.
describe("browser error tracking, unconfigured", () => {
  it("is off in a non-production build", () => {
    expect(ERROR_TRACKING_ENABLED).toBe(false);
  });

  // Every public entry point is exercised: each one is a place a missing
  // ERROR_TRACKING_ENABLED guard would pull the SDK in.
  it("never imports or initializes the SDK", async () => {
    initErrorTracking();
    captureException(new Error("boom"));
    registerViewer("user_123");
    registerViewer(null);
    // A macrotask, so a dynamic import would have settled by the assertion.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(sdkImports).toBe(0);
    expect(init).not.toHaveBeenCalled();
  });
});

function exceptionEvent(list: Array<{ type: string; value: string }>) {
  return {
    uuid: "evt",
    event: "$exception",
    properties: { $exception_list: list },
  };
}

describe("dropBenignExceptions", () => {
  // Both fired on every interrupted route cross-fade once view transitions
  // shipped, with no stack and no user-visible effect.
  it("drops interrupted view transitions", () => {
    for (const value of [
      "AbortError: Transition was skipped",
      "AbortError: Transition was skipped. New ViewTransition started",
      "InvalidStateError: Transition was aborted because of invalid state",
      "InvalidStateError: Transition was aborted because of invalid state. Viewport size changed",
    ]) {
      expect(
        dropBenignExceptions(exceptionEvent([{ type: "DOMException", value }])),
      ).toBeNull();
    }
  });

  it("drops the ResizeObserver loop notice", () => {
    expect(
      dropBenignExceptions(
        exceptionEvent([
          {
            type: "Error",
            value:
              "ResizeObserver loop completed with undelivered notifications.",
          },
        ]),
      ),
    ).toBeNull();
  });

  it("keeps other DOMExceptions", () => {
    const event = exceptionEvent([
      {
        type: "DOMException",
        value:
          "InvalidAccessError: Failed to execute 'subscribe' on 'PushManager': The provided applicationServerKey is not valid.",
      },
    ]);
    expect(dropBenignExceptions(event)).toBe(event);
  });

  it("keeps a chain where only one link is benign", () => {
    const event = exceptionEvent([
      { type: "TypeError", value: "Cannot read properties of undefined" },
      { type: "DOMException", value: "AbortError: Transition was skipped" },
    ]);
    expect(dropBenignExceptions(event)).toBe(event);
  });

  it("leaves non-exception events alone", () => {
    const event = { uuid: "evt", event: "$pageview", properties: {} };
    expect(dropBenignExceptions(event)).toBe(event);
  });
});
