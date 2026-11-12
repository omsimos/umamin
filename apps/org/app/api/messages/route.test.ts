import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getOrgMessagesPage: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSession: (...args: unknown[]) => mocks.getSession(...args),
}));

vi.mock("@/lib/server/data", () => ({
  getOrgMessagesPage: (...args: unknown[]) => mocks.getOrgMessagesPage(...args),
}));

vi.mock("@/lib/ratelimit", () => ({
  checkReadRateLimit: async () => true,
  RATE_LIMIT_ERROR: "Too many requests",
}));

import { GET } from "./route";

function call(url = "http://org.test/api/messages") {
  return GET(new Request(url) as never, { params: Promise.resolve({}) });
}

function signedIn(mustChangePassword: boolean) {
  return {
    session: { id: "s1", orgId: "org-1", expiresAt: Date.now() + 1e9 },
    user: { id: "org-1", username: "acme", mustChangePassword },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ session: null, user: null });
  mocks.getOrgMessagesPage.mockResolvedValue({
    messages: [],
    nextCursor: null,
  });
});

describe("GET /api/messages", () => {
  it("returns 401 without a session", async () => {
    const res = await call();

    expect(res.status).toBe(401);
    expect(mocks.getOrgMessagesPage).not.toHaveBeenCalled();
  });

  it("returns 403 for an account that still has its default password", async () => {
    mocks.getSession.mockResolvedValue(signedIn(true));

    const res = await call();

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: "Set a new password before you continue.",
    });
    expect(mocks.getOrgMessagesPage).not.toHaveBeenCalled();
  });

  it("returns the org's messages with the cursor passed through", async () => {
    mocks.getSession.mockResolvedValue(signedIn(false));

    const res = await call("http://org.test/api/messages?cursor=abc");

    expect(res.status).toBe(200);
    expect(mocks.getOrgMessagesPage).toHaveBeenCalledWith({
      orgId: "org-1",
      cursor: "abc",
    });
    expect(res.headers.get("Cache-Control")).toBe(
      "private, no-store, max-age=0",
    );
  });
});
