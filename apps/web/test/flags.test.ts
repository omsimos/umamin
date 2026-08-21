import { beforeEach, describe, expect, it, vi } from "vitest";

const evaluateFlags = vi.fn();
const construct = vi.fn();

vi.mock("posthog-node", () => ({
  PostHog: class {
    evaluateFlags = evaluateFlags;
    constructor(token: string, options: unknown) {
      construct(token, options);
    }
  },
}));

const { FLAG_UMAMIN_PRO } = await import("@/lib/flags");
const { __clearFlagCache, isFlagEnabled, resolveFlags } = await import(
  "@/server-lib/flags"
);

const ENV = {
  POSTHOG_PROJECT_TOKEN: "phc_test",
  POSTHOG_HOST: "https://us.i.posthog.com",
  // biome-ignore lint/suspicious/noExplicitAny: partial env stub
} as any;

// `evaluateFlags` returns a snapshot object, not a plain map — the wrapper reads
// it via isEnabled(), which is also what makes an unknown key resolve to false.
function snapshot(flags: Record<string, boolean>) {
  return { isEnabled: (key: string) => flags[key] ?? false };
}

beforeEach(() => {
  __clearFlagCache();
  evaluateFlags.mockReset();
  construct.mockReset();
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
});
