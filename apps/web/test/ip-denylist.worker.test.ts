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
  beforeEach(async () => {
    __clearDenylistCache();
    await kv.delete("ip:denylist");
  });

  it("denies a listed IP and allows others", async () => {
    await denyIp(kv, "203.0.113.5");
    __clearDenylistCache();
    expect(await isIpDenied(kv, "203.0.113.5")).toBe(true);
    expect(await isIpDenied(kv, "203.0.113.6")).toBe(false);
  });

  it("persists as a single JSON-array KV key", async () => {
    await denyIp(kv, "203.0.113.5");
    await denyIp(kv, "203.0.113.6");
    expect(await kv.get<string[]>("ip:denylist", "json")).toEqual([
      "203.0.113.5",
      "203.0.113.6",
    ]);
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
    await kv.put("ip:denylist", JSON.stringify([]));
    expect(await isIpDenied(kv, "203.0.113.9")).toBe(true);
  });
});
