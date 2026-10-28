import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../src/server-lib/db";

let testDb: Db;
vi.mock("../src/server-lib/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/server-lib/db")>()),
  getDb: () => testDb,
}));
vi.mock("../src/server-lib/posthog", () => ({
  captureRequestException: vi.fn(),
  captureServerException: vi.fn(),
}));

import { dmPurgeTable } from "@umamin/db/schema/dm";
import { drainDmPurge } from "../src/server-lib/dm/lifecycle";
import type { AppEnv } from "../src/server-lib/env";
import { makeTestDb } from "./helpers/db";

describe("drainDmPurge", () => {
  const purged: string[] = [];
  let failing: string | null;

  const env = {
    DM_ROOM: {
      idFromName: (name: string) => name,
      get: (name: string) => ({
        purge: async () => {
          if (name === failing) throw new Error("room unavailable");
          purged.push(name);
        },
      }),
    },
  } as unknown as AppEnv;

  async function queued() {
    const rows = await testDb
      .select({ threadId: dmPurgeTable.threadId })
      .from(dmPurgeTable);
    return rows.map((r) => r.threadId).sort();
  }

  beforeEach(async () => {
    purged.length = 0;
    failing = "dm:v1:c:d";
    testDb = await makeTestDb();
    await testDb
      .insert(dmPurgeTable)
      .values([{ threadId: "a:b" }, { threadId: "c:d" }, { threadId: "e:f" }]);
  });

  it("purges every room it can and keeps the failing one queued", async () => {
    expect(await drainDmPurge(env)).toBe(2);

    expect(purged.sort()).toEqual(["dm:v1:a:b", "dm:v1:e:f"]);
    expect(await queued()).toEqual(["c:d"]);
  });

  it("retries the kept room on the next run and empties the queue", async () => {
    await drainDmPurge(env);
    failing = null;
    purged.length = 0;

    expect(await drainDmPurge(env)).toBe(1);

    expect(purged).toEqual(["dm:v1:c:d"]);
    expect(await queued()).toEqual([]);
  });
});
