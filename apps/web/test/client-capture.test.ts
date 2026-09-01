import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const captureException = vi.fn();
vi.mock("@/lib/posthog", () => ({
  ERROR_TRACKING_ENABLED: false,
  initErrorTracking: vi.fn(),
  registerViewer: vi.fn(),
  captureException: (error: unknown, properties?: Record<string, unknown>) =>
    captureException(error, properties),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (m: string) => toastSuccess(m),
    error: (m: string) => toastError(m),
  },
}));

const { callAction } = await import("@/lib/api");
const { shareProfile } = await import("@/components/share-button");

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// callAction normalizes every transport failure into `{ error }` so call sites
// never have to try/catch. That is also how a broken deploy, a CSP block or a
// credentials bug used to vanish: the server never saw the request, so PostHog
// is the only place the failure can surface.
describe("callAction transport failures", () => {
  it("reports a failed request the server never received", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );

    const res = await callAction("likePostAction");

    expect(res).toEqual({ error: "An error occurred" });
    expect(captureException).toHaveBeenCalledWith(
      expect.any(TypeError),
      expect.objectContaining({
        source: "callAction",
        action: "likePostAction",
      }),
    );
  });

  it("stays silent when the caller aborted the request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("aborted", "AbortError")),
    );

    const res = await callAction("likePostAction");

    expect(res).toEqual({ error: "An error occurred" });
    expect(captureException).not.toHaveBeenCalled();
  });
});

// jsdom leaves navigator.share undefined, so shareProfile takes the clipboard
// branch. The regression: the write used to be un-awaited, so a denied
// clipboard still showed "Profile link copied."
describe("shareProfile clipboard failures", () => {
  it("does not claim success when the clipboard write is rejected", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
      configurable: true,
    });

    await shareProfile("alice");

    expect(toastSuccess).not.toHaveBeenCalled();
    expect(captureException).toHaveBeenCalledTimes(1);
  });
});
