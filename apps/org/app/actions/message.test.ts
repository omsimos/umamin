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
}));

vi.mock("@umamin/org-db", () => ({
  db: {
    select: (...args: unknown[]) => mocks.select(...args),
    insert: (...args: unknown[]) => mocks.insert(...args),
  },
}));

vi.mock("@umamin/encryption", () => ({
  aesEncrypt: (...args: unknown[]) => mocks.aesEncrypt(...args),
}));

vi.mock("@/lib/auth", () => ({
  getSession: async () => ({ session: null, user: null }),
}));

vi.mock("@/lib/ratelimit", () => ({
  getClientIp: async () => "127.0.0.1",
  checkRateLimit: (...args: unknown[]) => mocks.checkRateLimit(...args),
  RATE_LIMIT_ERROR: "Too many requests",
}));

import { sendMessageAction } from "./message";

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
