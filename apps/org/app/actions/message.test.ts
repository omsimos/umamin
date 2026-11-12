import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  state: {
    orgRows: [] as Array<{
      id: string;
      question: string;
      acceptingMessages: boolean;
      messageCharLimit: number | null;
    }>,
  },
  select: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
  aesEncrypt: vi.fn(),
  checkRateLimit: vi.fn(),
  getSession: vi.fn(),
  del: vi.fn(),
  where: vi.fn(),
}));

vi.mock("@umamin/org-db", () => ({
  db: {
    select: (...args: unknown[]) => mocks.select(...args),
    insert: (...args: unknown[]) => mocks.insert(...args),
    delete: (...args: unknown[]) => mocks.del(...args),
  },
}));

vi.mock("@umamin/encryption", () => ({
  aesEncrypt: (...args: unknown[]) => mocks.aesEncrypt(...args),
}));

vi.mock("@/lib/auth", () => ({
  getSession: (...args: unknown[]) => mocks.getSession(...args),
}));

vi.mock("@/lib/ratelimit", () => ({
  getClientIp: async () => "127.0.0.1",
  checkRateLimit: (...args: unknown[]) => mocks.checkRateLimit(...args),
  RATE_LIMIT_ERROR: "Too many requests",
}));

import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { deleteMessageAction, sendMessageAction } from "./message";

function org(messageCharLimit: number | null, acceptingMessages = true) {
  return {
    id: "org-1",
    question: "Tell us what you think",
    acceptingMessages,
    messageCharLimit,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ session: null, user: null });
  mocks.del.mockReturnValue({ where: mocks.where });
  mocks.where.mockResolvedValue(undefined);
  mocks.state.orgRows = [org(null)];
  mocks.checkRateLimit.mockResolvedValue(true);
  mocks.aesEncrypt.mockResolvedValue("encrypted-content");
  mocks.select.mockReturnValue({
    from: () => ({
      where: () => ({
        limit: async () => mocks.state.orgRows,
      }),
    }),
  });
  mocks.insert.mockReturnValue({ values: mocks.values });
  mocks.values.mockResolvedValue(undefined);
});

describe("sendMessageAction character limits", () => {
  it("uses the 1,000-character default when the override is unset", async () => {
    expect(
      await sendMessageAction({ orgId: "org-1", content: "a".repeat(1000) }),
    ).toEqual({ success: true });

    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ session: null, user: null });
    mocks.checkRateLimit.mockResolvedValue(true);
    mocks.select.mockReturnValue({
      from: () => ({
        where: () => ({ limit: async () => [org(null)] }),
      }),
    });

    expect(
      await sendMessageAction({ orgId: "org-1", content: "a".repeat(1001) }),
    ).toEqual({ error: "Message cannot exceed 1000 characters" });
    expect(mocks.aesEncrypt).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("enforces a custom organization limit", async () => {
    mocks.state.orgRows = [org(250)];

    expect(
      await sendMessageAction({ orgId: "org-1", content: "a".repeat(251) }),
    ).toEqual({ error: "Message cannot exceed 250 characters" });
    expect(mocks.aesEncrypt).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("accepts content at a custom organization limit", async () => {
    mocks.state.orgRows = [org(250)];

    expect(
      await sendMessageAction({ orgId: "org-1", content: "a".repeat(250) }),
    ).toEqual({ success: true });
    expect(mocks.aesEncrypt).toHaveBeenCalledOnce();
    expect(mocks.values).toHaveBeenCalledWith({
      orgId: "org-1",
      question: "Tell us what you think",
      content: "encrypted-content",
    });
  });

  it.each([
    { label: "missing", rows: [] },
    { label: "paused", rows: [org(250, false)] },
  ])("silently succeeds for a $label organization", async ({ rows }) => {
    mocks.state.orgRows = rows;

    expect(
      await sendMessageAction({ orgId: "org-1", content: "hello" }),
    ).toEqual({ success: true });
    expect(mocks.aesEncrypt).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});

describe("sendMessageAction organization cap", () => {
  it("refuses a send once the organization is over its cap", async () => {
    mocks.checkRateLimit.mockImplementation(
      async (name: string) => name !== "orgInbox",
    );

    expect(
      await sendMessageAction({ orgId: "org-1", content: "hello" }),
    ).toEqual({ error: "Too many requests" });
    expect(mocks.aesEncrypt).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("keys the cap on the organization id", async () => {
    expect(
      await sendMessageAction({ orgId: "org-1", content: "hello" }),
    ).toEqual({ success: true });
    expect(mocks.checkRateLimit).toHaveBeenCalledWith(
      "orgInbox",
      "msg-org:org-1",
    );
  });

  it("doesn't check the cap for a missing organization", async () => {
    mocks.state.orgRows = [];

    await sendMessageAction({ orgId: "org-1", content: "hello" });

    expect(mocks.checkRateLimit).not.toHaveBeenCalledWith(
      "orgInbox",
      expect.anything(),
    );
  });

  it("an over-long message doesn't spend the organization's cap", async () => {
    mocks.state.orgRows = [org(250)];

    await sendMessageAction({ orgId: "org-1", content: "a".repeat(251) });

    expect(mocks.checkRateLimit).not.toHaveBeenCalledWith(
      "orgInbox",
      expect.anything(),
    );
  });
});

function signedInAs(mustChangePassword: boolean) {
  return {
    session: { id: "s1", orgId: "org-1", expiresAt: Date.now() + 1e9 },
    user: { id: "org-1", username: "acme", mustChangePassword },
  };
}

describe("deleteMessageAction", () => {
  it("deletes only the signed-in organization's message", async () => {
    mocks.getSession.mockResolvedValue(signedInAs(false));

    expect(await deleteMessageAction("m1")).toEqual({ success: true });

    const condition = mocks.where.mock.calls[0]?.[0];
    const query = new SQLiteSyncDialect().sqlToQuery(condition);
    expect(query.sql).toContain('"org_message"."id" = ?');
    expect(query.sql).toContain('"org_message"."org_id" = ?');
    expect(query.params).toEqual(["m1", "org-1"]);
  });

  it("refuses without a session", async () => {
    const result = await deleteMessageAction("m1");

    expect(result).toHaveProperty("error");
    expect(mocks.del).not.toHaveBeenCalled();
  });

  it("refuses an account that still has its default password", async () => {
    mocks.getSession.mockResolvedValue(signedInAs(true));

    expect(await deleteMessageAction("m1")).toEqual({
      error: "Set a new password before you continue.",
    });
    expect(mocks.del).not.toHaveBeenCalled();
  });
});
