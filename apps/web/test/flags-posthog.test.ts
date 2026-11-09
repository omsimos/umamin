import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// flags.test.ts mocks posthog-node. This suite runs the real SDK against a
// stubbed fetch, because telling a failed /flags request from a key PostHog
// left out depends on how the SDK surfaces the failure, which a mock would
// only restate.

const captureServerException = vi.fn();
vi.mock("@/server-lib/posthog", () => ({
  captureServerException,
  captureRequestException: vi.fn(),
}));

const { FLAG_UMAMIN_CHAT } = await import("@/lib/flags");
const { __clearFlagCache, isUmaminChatEnabled } =
  await import("@/server-lib/flags");

const ENV = {
  POSTHOG_PROJECT_TOKEN: "phc_test",
  POSTHOG_HOST: "https://flags.test",
  // oxlint-disable-next-line typescript/no-explicit-any -- partial env stub
} as any;

const fetchMock = vi.fn();

function reported() {
  return captureServerException.mock.calls.map(([, , error, context]) => ({
    message: (error as Error).message,
    reason: context?.properties?.reason,
  }));
}

beforeEach(() => {
  __clearFlagCache();
  captureServerException.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("flag evaluation against the real posthog-node", () => {
  it("reads an answered flag", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        flags: {
          [FLAG_UMAMIN_CHAT]: {
            key: FLAG_UMAMIN_CHAT,
            enabled: true,
            variant: null,
            reason: { code: "condition_match" },
            metadata: { id: 1, version: 1 },
          },
        },
        errorsWhileComputingFlags: false,
        requestId: "r1",
      }),
    );
    expect(await isUmaminChatEnabled(ENV)).toBe(true);
    expect(captureServerException).not.toHaveBeenCalled();
  });

  it("reports a key PostHog left out as missing, not as a failure", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        flags: {},
        errorsWhileComputingFlags: false,
        requestId: "r1",
      }),
    );
    expect(await isUmaminChatEnabled(ENV)).toBe(false);
    expect(reported()).toEqual([
      { message: "flag not returned by PostHog", reason: undefined },
    ]);
  });

  // flags.ts reads these off private SDK fields; this pins that the real SDK
  // still sets them, so an upgrade can't quietly turn a partial answer into
  // "switched off".
  it("reports a quota-limited answer as a failed request", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        flags: {},
        errorsWhileComputingFlags: false,
        quotaLimited: ["feature_flags"],
        requestId: "r1",
      }),
    );
    expect(await isUmaminChatEnabled(ENV)).toBe(false);
    expect(reported()).toEqual([
      { message: "flag evaluation request failed", reason: "quota limited" },
    ]);
  });

  it("reports a partly computed answer as a failed request", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        flags: {},
        errorsWhileComputingFlags: true,
        requestId: "r1",
      }),
    );
    await isUmaminChatEnabled(ENV);
    expect(reported()).toEqual([
      {
        message: "flag evaluation request failed",
        reason: "errors while computing",
      },
    ]);
  });

  it("reports an HTTP error as a failed request", async () => {
    fetchMock.mockResolvedValue(new Response("oops", { status: 500 }));
    expect(await isUmaminChatEnabled(ENV)).toBe(false);
    expect(reported()).toEqual([
      { message: "flag evaluation request failed", reason: "HTTP 500" },
    ]);
  });

  it("reports a network error as a failed request", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    await isUmaminChatEnabled(ENV);
    expect(reported()).toEqual([
      {
        message: "flag evaluation request failed",
        reason: expect.any(String),
      },
    ]);
  });

  it("reports a timeout as a failed request", async () => {
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(init.signal?.reason),
          );
        }),
    );
    await isUmaminChatEnabled(ENV);
    expect(reported()).toEqual([
      { message: "flag evaluation request failed", reason: "timeout" },
    ]);
  });
});
