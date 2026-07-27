import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import {
  checkGroupEditWindow,
  GROUP_EDIT_DAILY_CAP,
} from "../src/server-lib/group-edit";

const kv = (env as { KV: KVNamespace }).KV;

// Real miniflare KV — the rolling 24h group-edit cap apps/www enforced with a
// Redis limiter (the Workers RL binding can't express a 1-day period).
describe("group edit window", () => {
  it("allows up to the daily cap, then rejects", async () => {
    const groupId = `g_${crypto.randomUUID()}`;

    for (let i = 0; i < GROUP_EDIT_DAILY_CAP; i += 1) {
      expect(await checkGroupEditWindow(kv, groupId)).toEqual({
        allowed: true,
      });
    }

    expect(await checkGroupEditWindow(kv, groupId)).toEqual({ allowed: false });
  });

  it("counts per group, not globally", async () => {
    const a = `g_${crypto.randomUUID()}`;
    const b = `g_${crypto.randomUUID()}`;

    for (let i = 0; i < GROUP_EDIT_DAILY_CAP; i += 1) {
      await checkGroupEditWindow(kv, a);
    }

    expect(await checkGroupEditWindow(kv, a)).toEqual({ allowed: false });
    expect(await checkGroupEditWindow(kv, b)).toEqual({ allowed: true });
  });

  it("starts a fresh window once the previous one has aged out", async () => {
    const groupId = `g_${crypto.randomUUID()}`;
    // Seed a full window that started just over 24h ago.
    await kv.put(
      `group-edit:${groupId}`,
      JSON.stringify({
        count: GROUP_EDIT_DAILY_CAP,
        startedAt: Date.now() - (24 * 60 * 60 * 1000 + 1000),
      }),
    );

    expect(await checkGroupEditWindow(kv, groupId)).toEqual({ allowed: true });
  });

  it("fails open without a KV binding (local dev)", async () => {
    expect(await checkGroupEditWindow(undefined, "g_none")).toEqual({
      allowed: true,
    });
  });

  it("fails open when KV throws", async () => {
    const broken = {
      get: () => Promise.reject(new Error("kv down")),
      put: () => Promise.reject(new Error("kv down")),
    } as unknown as KVNamespace;

    expect(await checkGroupEditWindow(broken, "g_broken")).toEqual({
      allowed: true,
    });
  });
});
