import { afterEach, describe, expect, it, vi } from "vitest";

const updateTag = vi.fn();
vi.mock("next/cache", () => ({
  updateTag: (tag: string) => updateTag(tag),
}));

const onConflictDoUpdate = vi.fn();
const values = vi.fn();
const insert = vi.fn();
vi.mock("@umamin/db", () => ({
  db: {
    insert: (table: unknown) => {
      insert(table);
      return {
        values: (row: unknown) => {
          values(row);
          return {
            onConflictDoUpdate: (conflict: unknown) =>
              onConflictDoUpdate(conflict),
          };
        },
      };
    },
  },
}));

import { notify } from "./notifications";

describe("notify", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("skips self-notifications entirely", async () => {
    await notify({ recipientId: "u1", type: "like", actorId: "u1" });

    expect(insert).not.toHaveBeenCalled();
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("upserts and invalidates the recipient's tag", async () => {
    onConflictDoUpdate.mockResolvedValueOnce(undefined);

    await notify({
      recipientId: "u2",
      type: "like",
      targetId: "p1",
      actorId: "u1",
      preview: "hello world",
    });

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: "u2",
        type: "like",
        targetId: "p1",
        actorId: "u1",
        preview: "hello world",
      }),
    );
    expect(updateTag).toHaveBeenCalledWith("notifications:u2");
  });

  it("trims previews to 80 chars and nulls empty ones", async () => {
    onConflictDoUpdate.mockResolvedValue(undefined);

    await notify({
      recipientId: "u2",
      type: "like",
      targetId: "p1",
      actorId: "u1",
      preview: "x".repeat(200),
    });
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ preview: "x".repeat(80) }),
    );

    await notify({
      recipientId: "u2",
      type: "like",
      targetId: "p2",
      actorId: "u1",
      // Image-only posts have empty content — no preview line, not "".
      preview: "",
    });
    expect(values).toHaveBeenLastCalledWith(
      expect.objectContaining({ preview: null }),
    );
  });

  it("swallows write failures so the parent action never fails", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    onConflictDoUpdate.mockRejectedValueOnce(new Error("db down"));

    await expect(
      notify({ recipientId: "u2", type: "follow", actorId: "u1" }),
    ).resolves.toBeUndefined();

    expect(updateTag).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
