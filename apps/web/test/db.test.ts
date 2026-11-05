import { userTable } from "@umamin/db/schema/user";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getDb } from "../src/server-lib/db";
import type { AppEnv } from "../src/server-lib/env";

describe("getDb", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("gives every Turso request a deadline", async () => {
    const signals: (AbortSignal | null | undefined)[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        signals.push(init?.signal);
        return new Response("", { status: 502 });
      }),
    );

    const db = getDb({ TURSO_CONNECTION_URL: "http://db.test" } as AppEnv);
    await db
      .select()
      .from(userTable)
      .limit(1)
      .catch(() => {});

    expect(signals.length).toBeGreaterThan(0);
    for (const signal of signals) expect(signal).toBeInstanceOf(AbortSignal);
  });
});
