import { afterEach, describe, expect, it, vi } from "vitest";

// The denylist keeps a module-scoped in-process cache, so each case resets
// modules and re-mocks the Redis client before importing a fresh copy.
afterEach(() => {
  vi.resetModules();
  vi.doUnmock("@/lib/redis");
});

describe("ip-denylist", () => {
  it("no-ops (allows everything) when Redis is unconfigured", async () => {
    vi.doMock("@/lib/redis", () => ({ redis: null }));
    const mod = await import("./ip-denylist");

    expect(await mod.isIpDenied("1.2.3.4")).toBe(false);
    expect(await mod.listDeniedIps()).toEqual([]);
    await expect(mod.denyIp("1.2.3.4")).resolves.toBeUndefined();
    await expect(mod.allowIp("1.2.3.4")).resolves.toBeUndefined();
  });

  it("blocks denied IPs and reflects deny/allow immediately on this instance", async () => {
    const store = new Set<string>(["6.6.6.6"]);
    vi.doMock("@/lib/redis", () => ({
      redis: {
        smembers: async () => [...store],
        sadd: async (_key: string, ip: string) => {
          store.add(ip);
          return 1;
        },
        srem: async (_key: string, ip: string) => {
          store.delete(ip);
          return 1;
        },
      },
    }));
    const mod = await import("./ip-denylist");

    expect(await mod.isIpDenied("6.6.6.6")).toBe(true);
    expect(await mod.isIpDenied("7.7.7.7")).toBe(false);

    // denyIp/allowIp bust the local cache so the mutating instance sees it now.
    await mod.denyIp("7.7.7.7");
    expect(await mod.isIpDenied("7.7.7.7")).toBe(true);

    await mod.allowIp("6.6.6.6");
    expect(await mod.isIpDenied("6.6.6.6")).toBe(false);
  });

  it("fails open if Redis throws", async () => {
    vi.doMock("@/lib/redis", () => ({
      redis: {
        smembers: async () => {
          throw new Error("redis down");
        },
        sadd: async () => 1,
        srem: async () => 1,
      },
    }));
    const mod = await import("./ip-denylist");

    expect(await mod.isIpDenied("8.8.8.8")).toBe(false);
  });
});
