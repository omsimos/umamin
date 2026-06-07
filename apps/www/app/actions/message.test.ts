import { beforeEach, describe, expect, it, vi } from "vitest";

const updateTag = vi.fn();
vi.mock("next/cache", () => ({
  updateTag: (tag: string) => updateTag(tag),
  revalidateTag: vi.fn(),
}));

// Mutable per-test fixtures consumed by the db mock's chain stubs.
const state = {
  updated: [] as unknown[],
};
const updateWhere = vi.fn();
const updateSet = vi.fn();

vi.mock("@umamin/db", () => ({
  db: {
    update: () => ({
      set: (values: unknown) => {
        updateSet(values);
        return {
          where: (condition: unknown) => {
            updateWhere(condition);
            return {
              returning: () => Promise.resolve(state.updated),
            };
          },
        };
      },
    }),
  },
}));

const getSession = vi.fn();
vi.mock("@/lib/auth", () => ({
  getSession: () => getSession(),
}));

const checkRateLimit = vi.fn();
vi.mock("@/lib/ratelimit", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimit(...args),
  getClientIp: vi.fn(),
  RATE_LIMIT_ERROR: "Too many requests",
}));

vi.mock("@/lib/server/notifications", () => ({ notify: vi.fn() }));
vi.mock("@umamin/encryption", () => ({ aesEncrypt: vi.fn() }));

import { openMessageAction } from "./message";

beforeEach(() => {
  vi.clearAllMocks();
  state.updated = [];
  getSession.mockResolvedValue({
    session: { userId: "viewer-1" },
    user: null,
  });
  checkRateLimit.mockResolvedValue(true);
});

describe("openMessageAction", () => {
  it("marks a sealed message opened and busts the viewer's received cache", async () => {
    state.updated = [{ id: "msg-1" }];

    const res = await openMessageAction({ messageId: "msg-1" });

    expect(res).toEqual({ success: true, opened: true });
    expect(updateSet).toHaveBeenCalledTimes(1);
    expect(updateSet.mock.calls[0][0]).toMatchObject({
      openedAt: expect.any(Date),
    });
    expect(updateTag).toHaveBeenCalledExactlyOnceWith(
      "messages:received:viewer-1",
    );
  });

  it("no-ops on an already-opened, foreign, or missing message without busting the cache", async () => {
    // The WHERE clause (id + receiverId = viewer + opened_at IS NULL) yields
    // zero rows for all three cases — same observable behavior by design (an
    // unknown id must not leak whether a message exists).
    state.updated = [];

    const res = await openMessageAction({ messageId: "msg-9" });

    expect(res).toEqual({ success: true, opened: false });
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("rate limits before writing anything", async () => {
    checkRateLimit.mockResolvedValue(false);

    const res = await openMessageAction({ messageId: "msg-1" });

    expect(res).toEqual({ error: "Too many requests" });
    expect(updateSet).not.toHaveBeenCalled();
    expect(updateTag).not.toHaveBeenCalled();
  });
});
