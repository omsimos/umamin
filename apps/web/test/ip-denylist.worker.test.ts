import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import {
  __clearDenylistCache,
  allowIp,
  denyIp,
  isIpDenied,
  listDeniedIps,
} from "../src/server-lib/ip-denylist";

// Real miniflare KV (kvNamespaces: ["KV"]).
const kv = (env as { KV: KVNamespace }).KV;

describe("ip-denylist (miniflare KV)", () => {
  async function clearKv() {
    await kv.delete("ip:denylist");
    const { keys } = await kv.list({ prefix: "ip:denylist:" });
    await Promise.all(keys.map((key) => kv.delete(key.name)));
  }

  beforeEach(async () => {
    __clearDenylistCache();
    await clearKv();
  });

  it("denies a listed IP and allows others", async () => {
    await denyIp(kv, "203.0.113.5");
    __clearDenylistCache();
    expect(await isIpDenied(kv, "203.0.113.5")).toBe(true);
    expect(await isIpDenied(kv, "203.0.113.6")).toBe(false);
  });

  // One key per entry, NOT a JSON array: an array means get→mutate→put, and on
  // eventually-consistent KV a second write can clobber the first.
  it("persists one KV key per entry", async () => {
    await denyIp(kv, "203.0.113.5");
    await denyIp(kv, "203.0.113.6");
    const { keys } = await kv.list({ prefix: "ip:denylist:" });
    expect(keys.map((key) => key.name).sort()).toEqual([
      "ip:denylist:203.0.113.5",
      "ip:denylist:203.0.113.6",
    ]);
    __clearDenylistCache();
    expect((await listDeniedIps(kv)).sort()).toEqual([
      "203.0.113.5",
      "203.0.113.6",
    ]);
  });

  // Entries written before the per-key layout must keep blocking, and unblock.
  it("still honours and prunes the legacy JSON-array key", async () => {
    await kv.put("ip:denylist", JSON.stringify(["203.0.113.77"]));
    __clearDenylistCache();
    expect(await isIpDenied(kv, "203.0.113.77")).toBe(true);

    await allowIp(kv, "203.0.113.77");
    __clearDenylistCache();
    expect(await isIpDenied(kv, "203.0.113.77")).toBe(false);
    expect(await kv.get<string[]>("ip:denylist", "json")).toEqual([]);
  });

  it("canonicalizes on store AND compare (equivalent IPv6 forms match)", async () => {
    await denyIp(kv, "2001:DB8::1");
    __clearDenylistCache();
    expect(
      await isIpDenied(kv, "2001:0db8:0000:0000:0000:0000:0000:0001"),
    ).toBe(true);
    expect(await listDeniedIps(kv)).toEqual([
      "2001:0db8:0000:0000:0000:0000:0000:0001",
    ]);
  });

  it("allowIp removes an entry", async () => {
    await denyIp(kv, "203.0.113.5");
    await allowIp(kv, "203.0.113.5");
    __clearDenylistCache();
    expect(await isIpDenied(kv, "203.0.113.5")).toBe(false);
  });

  it("fails open / no-ops without a KV binding", async () => {
    expect(await isIpDenied(undefined, "1.1.1.1")).toBe(false);
    await expect(denyIp(undefined, "1.1.1.1")).resolves.toBeUndefined();
    expect(await listDeniedIps(undefined)).toEqual([]);
  });

  it("serves from the in-process cache within the TTL (no KV re-read every call)", async () => {
    await denyIp(kv, "203.0.113.9");
    __clearDenylistCache();
    // Warm the cache, then mutate KV out-of-band; the cached read still wins.
    expect(await isIpDenied(kv, "203.0.113.9")).toBe(true);
    await clearKv();
    expect(await isIpDenied(kv, "203.0.113.9")).toBe(true);
  });
});
