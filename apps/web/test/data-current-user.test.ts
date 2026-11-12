import { groupTable } from "@umamin/db/schema/group";
import { accountTable, userTable } from "@umamin/db/schema/user";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentUserData } from "../src/server-lib/data";
import type { Db } from "../src/server-lib/db";
import { makeTestDb } from "./helpers/db";

// /api/me runs on nearly every signed-in page, so each statement it issues is a
// round trip to Turso on the critical path.
describe("getCurrentUserData group badge (real libSQL)", () => {
  let db: Db;

  beforeEach(async () => {
    db = await makeTestDb();
    await db.insert(userTable).values({ id: "me", username: "u_me" });
    await db.insert(groupTable).values({
      id: "g1",
      name: "Night owls",
      tag: "OWLS",
      tagNorm: "OWLS",
      icon: "moon",
      accent: "violet",
      creatorId: "me",
    });
  });

  function countStatements() {
    const client = (db as unknown as { $client: { execute: () => unknown } })
      .$client;
    return vi.spyOn(client, "execute");
  }

  it("returns the equipped badge without a separate group lookup", async () => {
    await db
      .update(userTable)
      .set({ equippedGroupId: "g1" })
      .where(eq(userTable.id, "me"));
    const execute = countStatements();

    const result = await getCurrentUserData(db, "me");

    expect(result.user?.groupBadge).toEqual({
      id: "g1",
      tag: "OWLS",
      icon: "moon",
      accent: "violet",
    });
    // The user row and the linked accounts, read concurrently.
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("returns no badge when none is equipped or the group is gone", async () => {
    expect((await getCurrentUserData(db, "me")).user?.groupBadge).toBeNull();

    await db
      .update(userTable)
      .set({ equippedGroupId: "deleted" })
      .where(eq(userTable.id, "me"));
    expect((await getCurrentUserData(db, "me")).user?.groupBadge).toBeNull();
  });

  it("returns linked accounts oldest first", async () => {
    await db.insert(accountTable).values({
      providerUserId: "b",
      email: "new@example.com",
      picture: "",
      userId: "me",
      providerId: "google",
      createdAt: new Date("2026-02-01T00:00:00Z"),
    });
    await db.insert(accountTable).values({
      providerUserId: "a",
      email: "old@example.com",
      picture: "",
      userId: "me",
      providerId: "google",
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });

    expect(
      (await getCurrentUserData(db, "me")).user?.accounts.map((a) => a.email),
    ).toEqual(["old@example.com", "new@example.com"]);
  });
});
