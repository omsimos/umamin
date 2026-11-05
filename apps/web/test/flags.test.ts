import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const evaluateFlags = vi.fn();
const construct = vi.fn();
// posthog-node reports a failed /flags request only on the client's "error"
// event, then resolves to an empty snapshot.
const errorListeners: ((error: unknown) => void)[] = [];

vi.mock("posthog-node", () => ({
  PostHog: class {
    evaluateFlags = evaluateFlags;
    on(event: string, listener: (error: unknown) => void) {
      if (event === "error") errorListeners.push(listener);
      return () => {};
    }
    constructor(token: string, options: unknown) {
      construct(token, options);
    }
  },
}));

const captureServerException = vi.fn();
vi.mock("@/server-lib/posthog", () => ({
  captureServerException,
  captureRequestException: vi.fn(),
}));

const {
  FLAG_CONTENT_MODERATION,
  FLAG_UMAMIN_CHAT,
  FLAG_UMAMIN_DM,
  FLAG_UMAMIN_PRO,
} = await import("@/lib/flags");
const {
  __clearFlagCache,
  isFlagEnabled,
  isModerationEnforced,
  isUmaminChatEnabled,
  refreshFlagSnapshot,
  resolveFlags,
  SNAPSHOT_FLAGS,
  SNAPSHOT_KV_KEY,
} = await import("@/server-lib/flags");

const ENV = {
  POSTHOG_PROJECT_TOKEN: "phc_test",
  POSTHOG_HOST: "https://us.i.posthog.com",
  // biome-ignore lint/suspicious/noExplicitAny: partial env stub
} as any;

// `evaluateFlags` returns a snapshot object, not a plain map. isEnabled() is
// false for an absent key, so the wrapper uses getFlag() (undefined when absent)
// to tell "PostHog said off" from "PostHog said nothing".
function snapshot(
  flags: Record<string, boolean>,
  health: { _quotaLimited?: boolean; _errorsWhileComputing?: boolean } = {},
) {
  return {
    ...health,
    isEnabled: (key: string) => flags[key] ?? false,
    getFlag: (key: string) => (key in flags ? flags[key] : undefined),
  };
}

// What posthog-node does when the /flags request times out.
async function failedRequest() {
  const timeout = new Error("Request timed out after 1000ms");
  timeout.name = "AbortError";
  for (const listener of errorListeners) listener({ error: timeout });
  return snapshot({});
}

function memoryKv(initial?: Record<string, unknown>) {
  const store = new Map<string, string>();
  if (initial) {
    for (const [key, value] of Object.entries(initial)) {
      store.set(key, JSON.stringify(value));
    }
  }
  const get = vi.fn(async (key: string, type?: string) => {
    const raw = store.get(key);
    if (raw === undefined) return null;
    return type === "json" ? JSON.parse(raw) : raw;
  });
  const put = vi.fn(
    async (key: string, value: string, _options?: KVNamespacePutOptions) => {
      store.set(key, value);
    },
  );
  return {
    kv: { get, put } as unknown as KVNamespace,
    get,
    put,
    read: (key: string) => {
      const raw = store.get(key);
      return raw === undefined ? undefined : JSON.parse(raw);
    },
  };
}

const ALL_ON = {
  [FLAG_CONTENT_MODERATION]: true,
  [FLAG_UMAMIN_CHAT]: true,
  [FLAG_UMAMIN_DM]: true,
  [FLAG_UMAMIN_PRO]: true,
};

beforeEach(() => {
  __clearFlagCache();
  evaluateFlags.mockReset();
  construct.mockReset();
  captureServerException.mockReset();
  errorListeners.length = 0;
  evaluateFlags.mockResolvedValue(snapshot({ [FLAG_UMAMIN_PRO]: true }));
});

describe("resolveFlags", () => {
  it("returns the evaluated value", async () => {
    const flags = await resolveFlags(ENV, "user_1", [FLAG_UMAMIN_PRO]);
    expect(flags[FLAG_UMAMIN_PRO]).toBe(true);
  });

  // Scoping the request keeps it to the one flag we asked about, and the new API
  // emits no $feature_flag_called event per evaluation.
  it("scopes the /flags request to the requested keys", async () => {
    await resolveFlags(ENV, "user_1", [FLAG_UMAMIN_PRO]);
    expect(evaluateFlags).toHaveBeenCalledWith("user_1", {
      flagKeys: [FLAG_UMAMIN_PRO],
    });
  });

  it("buckets an anonymous viewer under a shared distinct id", async () => {
    await resolveFlags(ENV, null, [FLAG_UMAMIN_PRO]);
    expect(evaluateFlags).toHaveBeenCalledWith("anonymous", {
      flagKeys: [FLAG_UMAMIN_PRO],
    });
  });

  // Fail-closed is the whole safety property: a PostHog outage must never be
  // what reveals an unlaunched product.
  it("resolves false when PostHog throws", async () => {
    evaluateFlags.mockRejectedValue(new Error("flags down"));
    const flags = await resolveFlags(ENV, "user_1", [FLAG_UMAMIN_PRO]);
    expect(flags[FLAG_UMAMIN_PRO]).toBe(false);
  });

  // Failing closed hides a launched surface, and Workers Logs alone would never
  // show it — the report is the only signal that it happened.
  it("reports the evaluation failure against the viewer", async () => {
    evaluateFlags.mockRejectedValue(new Error("flags down"));
    await resolveFlags(ENV, "user_1", [FLAG_UMAMIN_PRO]);
    expect(captureServerException).toHaveBeenCalledTimes(1);
    expect(captureServerException.mock.calls[0][3]).toEqual({
      distinctId: "user_1",
      properties: { flags: FLAG_UMAMIN_PRO },
    });
  });

  it("resolves false without a project token, and never calls out", async () => {
    // biome-ignore lint/suspicious/noExplicitAny: partial env stub
    const flags = await resolveFlags({} as any, "user_1", [FLAG_UMAMIN_PRO]);
    expect(flags[FLAG_UMAMIN_PRO]).toBe(false);
    expect(construct).not.toHaveBeenCalled();
  });

  // A failure is deliberately NOT cached, or one blip would pin the surface off
  // for the whole TTL.
  it("does not cache a failure", async () => {
    evaluateFlags.mockRejectedValueOnce(new Error("flags down"));
    expect(
      (await resolveFlags(ENV, "user_1", [FLAG_UMAMIN_PRO]))[FLAG_UMAMIN_PRO],
    ).toBe(false);
    expect(
      (await resolveFlags(ENV, "user_1", [FLAG_UMAMIN_PRO]))[FLAG_UMAMIN_PRO],
    ).toBe(true);
  });

  it("serves a repeat lookup from the in-isolate cache", async () => {
    await resolveFlags(ENV, "user_1", [FLAG_UMAMIN_PRO]);
    await resolveFlags(ENV, "user_1", [FLAG_UMAMIN_PRO]);
    expect(evaluateFlags).toHaveBeenCalledTimes(1);
  });

  it("caches per viewer, so one bucket can't leak to another", async () => {
    evaluateFlags.mockImplementation((distinctId: string) =>
      Promise.resolve(snapshot({ [FLAG_UMAMIN_PRO]: distinctId === "user_1" })),
    );
    expect(await isFlagEnabled(ENV, "user_1", FLAG_UMAMIN_PRO)).toBe(true);
    expect(await isFlagEnabled(ENV, "user_2", FLAG_UMAMIN_PRO)).toBe(false);
  });

  // Parallel loaders on one page resolve the same viewer at once; collapsing
  // them is what keeps that one /flags request instead of N.
  it("collapses concurrent lookups into one request", async () => {
    await Promise.all([
      resolveFlags(ENV, "user_1", [FLAG_UMAMIN_PRO]),
      resolveFlags(ENV, "user_1", [FLAG_UMAMIN_PRO]),
      resolveFlags(ENV, "user_1", [FLAG_UMAMIN_PRO]),
    ]);
    expect(evaluateFlags).toHaveBeenCalledTimes(1);
  });

  it("honours FLAGS_FORCE_ON without contacting PostHog", async () => {
    const flags = await resolveFlags(
      // biome-ignore lint/suspicious/noExplicitAny: partial env stub
      { FLAGS_FORCE_ON: ` ${FLAG_UMAMIN_PRO} , other ` } as any,
      "user_1",
      [FLAG_UMAMIN_PRO],
    );
    expect(flags[FLAG_UMAMIN_PRO]).toBe(true);
    expect(construct).not.toHaveBeenCalled();
  });

  it("resolves an unknown flag key to false", async () => {
    evaluateFlags.mockResolvedValue(snapshot({}));
    expect(await isFlagEnabled(ENV, "user_1", "not-a-real-flag")).toBe(false);
  });

  it("passes a short timeout and no retries to the client", async () => {
    await resolveFlags(ENV, "user_1", [FLAG_UMAMIN_PRO]);
    expect(construct.mock.calls[0][1]).toMatchObject({
      featureFlagsRequestTimeoutMs: 1000,
      featureFlagsRequestMaxRetries: 0,
    });
  });

  describe("when PostHog gives no answer", () => {
    function at(ms: number) {
      return vi.spyOn(Date, "now").mockReturnValue(ms);
    }

    afterEach(() => {
      vi.restoreAllMocks();
    });

    // Off uncovers severe content in shared caches and the Hot ranking, so an
    // outage must not be what turns moderation off.
    it("keeps content moderation ON when PostHog throws", async () => {
      evaluateFlags.mockRejectedValue(new Error("flags down"));
      expect(await isFlagEnabled(ENV, null, FLAG_CONTENT_MODERATION)).toBe(
        true,
      );
    });

    // posthog-node swallows a failed fetch into an empty snapshot; reading it as
    // "off" is how moderation used to switch itself off for a minute.
    it("treats an empty snapshot as no answer, not as off", async () => {
      evaluateFlags.mockResolvedValue(snapshot({}));
      const flags = await resolveFlags(ENV, null, [
        FLAG_CONTENT_MODERATION,
        FLAG_UMAMIN_PRO,
      ]);
      expect(flags[FLAG_CONTENT_MODERATION]).toBe(true);
      expect(flags[FLAG_UMAMIN_PRO]).toBe(false);
      expect(captureServerException).toHaveBeenCalledTimes(1);
    });

    it("still honours an explicit off answer", async () => {
      evaluateFlags.mockResolvedValue(
        snapshot({ [FLAG_CONTENT_MODERATION]: false }),
      );
      expect(await isFlagEnabled(ENV, null, FLAG_CONTENT_MODERATION)).toBe(
        false,
      );
      expect(captureServerException).not.toHaveBeenCalled();
    });

    it("prefers the last real answer during an outage", async () => {
      const now = at(1_000_000);
      evaluateFlags.mockResolvedValueOnce(
        snapshot({ [FLAG_CONTENT_MODERATION]: false }),
      );
      expect(await isFlagEnabled(ENV, null, FLAG_CONTENT_MODERATION)).toBe(
        false,
      );

      now.mockReturnValue(1_000_000 + 61_000);
      evaluateFlags.mockImplementationOnce(failedRequest);
      expect(await isFlagEnabled(ENV, null, FLAG_CONTENT_MODERATION)).toBe(
        false,
      );
    });

    // PostHog leaves a switched-off flag out of its answer. Treating that as
    // an outage kept a kill switch on for the life of the isolate.
    it("turns a switched-off flag off instead of keeping the last answer", async () => {
      const now = at(1_000_000);
      evaluateFlags.mockResolvedValueOnce(
        snapshot({ [FLAG_UMAMIN_CHAT]: true }),
      );
      expect(await isFlagEnabled(ENV, null, FLAG_UMAMIN_CHAT)).toBe(true);

      now.mockReturnValue(1_000_000 + 61_000);
      evaluateFlags.mockResolvedValueOnce(snapshot({}));
      expect(await isFlagEnabled(ENV, null, FLAG_UMAMIN_CHAT)).toBe(false);
    });

    it("treats a quota-limited answer as an outage, keeping the last answer", async () => {
      const now = at(1_000_000);
      evaluateFlags.mockResolvedValueOnce(
        snapshot({ [FLAG_UMAMIN_CHAT]: true }),
      );
      await isFlagEnabled(ENV, null, FLAG_UMAMIN_CHAT);

      now.mockReturnValue(1_000_000 + 61_000);
      evaluateFlags.mockResolvedValueOnce(
        snapshot({}, { _quotaLimited: true }),
      );
      expect(await isFlagEnabled(ENV, null, FLAG_UMAMIN_CHAT)).toBe(true);

      // Cached as a failure (10 s), not as an answer (60 s).
      now.mockReturnValue(1_000_000 + 61_000 + 11_000);
      evaluateFlags.mockResolvedValueOnce(
        snapshot({ [FLAG_UMAMIN_CHAT]: true }),
      );
      await isFlagEnabled(ENV, null, FLAG_UMAMIN_CHAT);
      expect(evaluateFlags).toHaveBeenCalledTimes(3);
    });

    it("caches a failed request for 10 seconds only", async () => {
      const now = at(1_000_000);
      evaluateFlags.mockImplementation(failedRequest);
      await isFlagEnabled(ENV, null, FLAG_CONTENT_MODERATION);

      now.mockReturnValue(1_000_000 + 5_000);
      await isFlagEnabled(ENV, null, FLAG_CONTENT_MODERATION);
      expect(evaluateFlags).toHaveBeenCalledTimes(1);

      now.mockReturnValue(1_000_000 + 11_000);
      await isFlagEnabled(ENV, null, FLAG_CONTENT_MODERATION);
      expect(evaluateFlags).toHaveBeenCalledTimes(2);
    });

    // A key PostHog left out is its answer until someone changes the flag, so
    // retrying it every 10 s only bought another /flags round trip.
    it("caches a key PostHog left out for the full minute", async () => {
      const now = at(1_000_000);
      evaluateFlags.mockResolvedValue(snapshot({}));
      await isFlagEnabled(ENV, "user_1", FLAG_UMAMIN_PRO);

      now.mockReturnValue(1_000_000 + 30_000);
      await isFlagEnabled(ENV, "user_1", FLAG_UMAMIN_PRO);
      expect(evaluateFlags).toHaveBeenCalledTimes(1);
    });

    it("reports a failed request with its reason, apart from a missing key", async () => {
      evaluateFlags.mockImplementation(failedRequest);
      await isFlagEnabled(ENV, null, FLAG_CONTENT_MODERATION);
      expect(captureServerException).toHaveBeenCalledTimes(1);
      const [, , error, context] = captureServerException.mock.calls[0];
      expect((error as Error).message).toBe("flag evaluation request failed");
      expect(context.properties).toEqual({
        flags: FLAG_CONTENT_MODERATION,
        reason: "timeout",
      });
    });

    it("reports a key PostHog left out at most once an hour", async () => {
      const now = at(1_000_000);
      evaluateFlags.mockResolvedValue(snapshot({}));
      await isFlagEnabled(ENV, "user_1", FLAG_UMAMIN_PRO);
      await isFlagEnabled(ENV, "user_2", FLAG_UMAMIN_PRO);
      await isFlagEnabled(ENV, "user_3", FLAG_UMAMIN_PRO);
      expect(evaluateFlags).toHaveBeenCalledTimes(3);
      expect(captureServerException).toHaveBeenCalledTimes(1);

      now.mockReturnValue(1_000_000 + 61 * 60_000);
      await isFlagEnabled(ENV, "user_4", FLAG_UMAMIN_PRO);
      expect(captureServerException).toHaveBeenCalledTimes(2);
      expect((captureServerException.mock.calls[0][2] as Error).message).toBe(
        "flag not returned by PostHog",
      );
    });

    it("keeps reporting failed requests", async () => {
      const now = at(1_000_000);
      evaluateFlags.mockImplementation(failedRequest);
      await isFlagEnabled(ENV, null, FLAG_CONTENT_MODERATION);
      now.mockReturnValue(1_000_000 + 11_000);
      await isFlagEnabled(ENV, null, FLAG_CONTENT_MODERATION);
      expect(captureServerException).toHaveBeenCalledTimes(2);
    });

    it("lets FLAGS_FORCE_ON win over a fallback", async () => {
      evaluateFlags.mockRejectedValue(new Error("flags down"));
      const flags = await resolveFlags(
        // biome-ignore lint/suspicious/noExplicitAny: partial env stub
        { ...ENV, FLAGS_FORCE_ON: FLAG_UMAMIN_PRO } as any,
        null,
        [FLAG_UMAMIN_PRO, FLAG_CONTENT_MODERATION],
      );
      expect(flags[FLAG_UMAMIN_PRO]).toBe(true);
    });
  });
});

const stored = (flags: Record<string, boolean>, refreshedAt = Date.now()) => ({
  [SNAPSHOT_KV_KEY]: { flags, refreshedAt },
});

describe("global flag snapshot", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("serves the global flags from KV without calling PostHog", async () => {
    const { kv } = memoryKv(
      stored({ ...ALL_ON, [FLAG_CONTENT_MODERATION]: false }),
    );
    const env = { ...ENV, KV: kv };
    expect(await isModerationEnforced(env)).toBe(false);
    expect(await isUmaminChatEnabled(env)).toBe(true);
    expect(evaluateFlags).not.toHaveBeenCalled();
  });

  it("reads KV once per isolate per minute, whatever the mix of flags", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    const { kv, get } = memoryKv(stored(ALL_ON));
    const env = { ...ENV, KV: kv };
    await Promise.all([
      isModerationEnforced(env),
      isUmaminChatEnabled(env),
      resolveFlags(env, null, [FLAG_UMAMIN_DM, FLAG_UMAMIN_PRO]),
    ]);
    await isModerationEnforced(env);
    expect(get).toHaveBeenCalledTimes(1);

    now.mockReturnValue(1_000_000 + 61_000);
    await isModerationEnforced(env);
    expect(get).toHaveBeenCalledTimes(2);
  });

  // A fresh deploy has no snapshot until the first cron run; it must behave
  // exactly as before, fallbacks included.
  it("falls back to live evaluation while there is no snapshot", async () => {
    const { kv } = memoryKv();
    evaluateFlags.mockResolvedValue(snapshot({}));
    const env = { ...ENV, KV: kv };
    expect(await isUmaminChatEnabled(env)).toBe(false);
    expect(await isModerationEnforced(env)).toBe(true);
    expect(evaluateFlags).toHaveBeenCalledWith("anonymous", {
      flagKeys: [FLAG_UMAMIN_CHAT],
    });
  });

  // A cron that stopped must not pin the kill switches for the KV TTL.
  it("evaluates live once the snapshot is older than 20 minutes", async () => {
    const { kv } = memoryKv(stored({ ...ALL_ON }, Date.now() - 21 * 60_000));
    evaluateFlags.mockResolvedValue(snapshot({ [FLAG_UMAMIN_CHAT]: false }));
    expect(await isUmaminChatEnabled({ ...ENV, KV: kv })).toBe(false);
    expect(evaluateFlags).toHaveBeenCalledTimes(1);
  });

  it("falls back to live evaluation when the snapshot lacks the key", async () => {
    const { kv } = memoryKv(stored({ [FLAG_CONTENT_MODERATION]: true }));
    evaluateFlags.mockResolvedValue(snapshot({ [FLAG_UMAMIN_CHAT]: true }));
    expect(await isUmaminChatEnabled({ ...ENV, KV: kv })).toBe(true);
    expect(evaluateFlags).toHaveBeenCalledTimes(1);
  });

  it("falls back to live evaluation when KV throws", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const kv = {
      get: vi.fn().mockRejectedValue(new Error("kv down")),
    } as unknown as KVNamespace;
    evaluateFlags.mockResolvedValue(snapshot({ [FLAG_UMAMIN_CHAT]: true }));
    expect(await isUmaminChatEnabled({ ...ENV, KV: kv })).toBe(true);
  });

  it("lets FLAGS_FORCE_ON win over a snapshot that says off", async () => {
    const { kv } = memoryKv(stored({ ...ALL_ON, [FLAG_UMAMIN_CHAT]: false }));
    expect(
      await isUmaminChatEnabled({
        ...ENV,
        KV: kv,
        FLAGS_FORCE_ON: FLAG_UMAMIN_CHAT,
      }),
    ).toBe(true);
  });

  // The anonymous bucket is shared; a signed-in viewer's Pro rollout is not.
  it("still evaluates Pro per signed-in viewer", async () => {
    const { kv } = memoryKv(stored({ ...ALL_ON, [FLAG_UMAMIN_PRO]: true }));
    evaluateFlags.mockResolvedValue(snapshot({ [FLAG_UMAMIN_PRO]: false }));
    const env = { ...ENV, KV: kv };
    expect(await isFlagEnabled(env, "user_1", FLAG_UMAMIN_PRO)).toBe(false);
    expect(evaluateFlags).toHaveBeenCalledWith("user_1", {
      flagKeys: [FLAG_UMAMIN_PRO],
    });
    expect(await isFlagEnabled(env, null, FLAG_UMAMIN_PRO)).toBe(true);
    expect(evaluateFlags).toHaveBeenCalledTimes(1);
  });
});

describe("refreshFlagSnapshot", () => {
  it("stores PostHog's answer for every global flag", async () => {
    const { kv, read, put } = memoryKv();
    evaluateFlags.mockResolvedValue(
      snapshot({ ...ALL_ON, [FLAG_UMAMIN_DM]: false }),
    );
    await refreshFlagSnapshot({ ...ENV, KV: kv });

    expect(evaluateFlags).toHaveBeenCalledWith("anonymous", {
      flagKeys: [...SNAPSHOT_FLAGS],
    });
    expect(construct.mock.calls[0][1]).toMatchObject({
      featureFlagsRequestTimeoutMs: 5000,
    });
    expect(read(SNAPSHOT_KV_KEY).flags).toEqual({
      ...ALL_ON,
      [FLAG_UMAMIN_DM]: false,
    });
    expect(put.mock.calls[0][2]).toMatchObject({
      expirationTtl: expect.any(Number),
    });
  });

  it("is what the request path reads afterwards", async () => {
    const { kv } = memoryKv();
    evaluateFlags.mockResolvedValue(snapshot(ALL_ON));
    await refreshFlagSnapshot({ ...ENV, KV: kv });
    evaluateFlags.mockClear();

    expect(await isUmaminChatEnabled({ ...ENV, KV: kv })).toBe(true);
    expect(evaluateFlags).not.toHaveBeenCalled();
  });

  // An outage must leave the last real answer in place, not overwrite it with
  // fallbacks that would hide chat everywhere.
  it("keeps the previous snapshot when the request fails", async () => {
    const { kv, put, read } = memoryKv(stored(ALL_ON));
    evaluateFlags.mockImplementation(failedRequest);
    await expect(refreshFlagSnapshot({ ...ENV, KV: kv })).rejects.toThrow(
      /timeout/,
    );
    expect(put).not.toHaveBeenCalled();
    expect(read(SNAPSHOT_KV_KEY).flags).toEqual(ALL_ON);
  });

  it("keeps the previous snapshot when the evaluation throws", async () => {
    const { kv, put } = memoryKv(stored(ALL_ON));
    evaluateFlags.mockRejectedValue(new Error("flags down"));
    await expect(refreshFlagSnapshot({ ...ENV, KV: kv })).rejects.toThrow();
    expect(put).not.toHaveBeenCalled();
  });

  it("keeps the previous snapshot when PostHog is quota limited", async () => {
    const { kv, put } = memoryKv(stored(ALL_ON));
    evaluateFlags.mockResolvedValue(snapshot({}, { _quotaLimited: true }));
    await expect(refreshFlagSnapshot({ ...ENV, KV: kv })).rejects.toThrow(
      /quota limited/,
    );
    expect(put).not.toHaveBeenCalled();
  });

  it("keeps the previous snapshot when PostHog answered only in part", async () => {
    const { kv, put } = memoryKv(stored(ALL_ON));
    evaluateFlags.mockResolvedValue(
      snapshot({ [FLAG_UMAMIN_DM]: true }, { _errorsWhileComputing: true }),
    );
    await expect(refreshFlagSnapshot({ ...ENV, KV: kv })).rejects.toThrow(
      /errors while computing/,
    );
    expect(put).not.toHaveBeenCalled();
  });

  // A left-out key was switched off or deleted; keeping its previous value
  // meant a kill switch could never be turned off.
  it("stores a left-out key as its fallback, not its previous value", async () => {
    const { kv, read } = memoryKv(
      stored({ ...ALL_ON, [FLAG_CONTENT_MODERATION]: false }),
    );
    evaluateFlags.mockResolvedValue(
      snapshot({ [FLAG_UMAMIN_DM]: true, [FLAG_UMAMIN_PRO]: false }),
    );
    await refreshFlagSnapshot({ ...ENV, KV: kv });
    expect(read(SNAPSHOT_KV_KEY).flags).toEqual({
      [FLAG_CONTENT_MODERATION]: true,
      [FLAG_UMAMIN_CHAT]: false,
      [FLAG_UMAMIN_DM]: true,
      [FLAG_UMAMIN_PRO]: false,
    });

    const fresh = memoryKv();
    evaluateFlags.mockResolvedValue(snapshot({ [FLAG_UMAMIN_DM]: true }));
    await refreshFlagSnapshot({ ...ENV, KV: fresh.kv });
    expect(fresh.read(SNAPSHOT_KV_KEY).flags).toEqual({
      [FLAG_CONTENT_MODERATION]: true,
      [FLAG_UMAMIN_CHAT]: false,
      [FLAG_UMAMIN_DM]: true,
      [FLAG_UMAMIN_PRO]: false,
    });
  });

  it("no-ops without a KV binding or a project token", async () => {
    await refreshFlagSnapshot(ENV);
    // biome-ignore lint/suspicious/noExplicitAny: partial env stub
    await refreshFlagSnapshot({ KV: memoryKv().kv } as any);
    expect(evaluateFlags).not.toHaveBeenCalled();
  });
});
