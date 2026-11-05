import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FLAG_CONTENT_MODERATION,
  FLAG_UMAMIN_CHAT,
  FLAG_UMAMIN_DM,
  FLAG_UMAMIN_PRO,
} from "../src/lib/flags";
import type { AppEnv } from "../src/server-lib/env";
import {
  __clearFlagCache,
  isModerationEnforced,
  isUmaminChatEnabled,
  refreshFlagSnapshot,
  SNAPSHOT_KV_KEY,
} from "../src/server-lib/flags";

// Real miniflare KV and the real posthog-node SDK, with only PostHog's /flags
// endpoint stubbed. Telling a failed request from a left-out key relies on
// AsyncLocalStorage carrying the evaluation into the SDK's error event, which
// is worth proving in workerd and not only in Node.

const kv = (env as { KV: KVNamespace }).KV;
const ENV = {
  KV: kv,
  POSTHOG_PROJECT_TOKEN: "phc_test",
  POSTHOG_HOST: "https://flags.test",
} as unknown as AppEnv;

const fetchMock = vi.fn();

function flagsResponse(flags: Record<string, boolean>) {
  return Response.json({
    flags: Object.fromEntries(
      Object.entries(flags).map(([key, enabled]) => [
        key,
        { key, enabled, variant: null, reason: { code: "x" }, metadata: {} },
      ]),
    ),
    errorsWhileComputingFlags: false,
    requestId: "r1",
  });
}

beforeEach(async () => {
  __clearFlagCache();
  await kv.delete(SNAPSHOT_KV_KEY);
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("flag snapshot in workerd", () => {
  it("serves what the cron stored without calling PostHog again", async () => {
    fetchMock.mockImplementation(async () =>
      flagsResponse({
        [FLAG_CONTENT_MODERATION]: false,
        [FLAG_UMAMIN_CHAT]: true,
        [FLAG_UMAMIN_DM]: true,
        [FLAG_UMAMIN_PRO]: false,
      }),
    );
    await refreshFlagSnapshot(ENV);
    const calls = fetchMock.mock.calls.length;

    __clearFlagCache();
    expect(await isUmaminChatEnabled(ENV)).toBe(true);
    expect(await isModerationEnforced(ENV)).toBe(false);
    expect(fetchMock.mock.calls.length).toBe(calls);
  });

  it("keeps the stored snapshot when PostHog fails", async () => {
    await kv.put(
      SNAPSHOT_KV_KEY,
      JSON.stringify({
        flags: { [FLAG_UMAMIN_CHAT]: true },
        refreshedAt: 1,
      }),
    );
    fetchMock.mockImplementation(
      async () => new Response("oops", { status: 503 }),
    );

    await expect(refreshFlagSnapshot(ENV)).rejects.toThrow(/HTTP 503/);
    expect(
      (
        await kv.get<{ flags: Record<string, boolean> }>(
          SNAPSHOT_KV_KEY,
          "json",
        )
      )?.flags,
    ).toEqual({ [FLAG_UMAMIN_CHAT]: true });
  });
});
