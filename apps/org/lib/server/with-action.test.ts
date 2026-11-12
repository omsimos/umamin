import { beforeEach, describe, expect, it, vi } from "vitest";
import * as z from "zod";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSession: (...args: unknown[]) => mocks.getSession(...args),
}));

vi.mock("@/lib/ratelimit", () => ({
  checkRateLimit: (...args: unknown[]) => mocks.checkRateLimit(...args),
  RATE_LIMIT_ERROR: "Too many requests",
}));

import {
  GENERIC_ERROR,
  INVALID_INPUT_ERROR,
  PASSWORD_CHANGE_REQUIRED_ERROR,
} from "./errors";
import { withAction } from "./with-action";

const session = { id: "s1", orgId: "org-1", expiresAt: Date.now() + 1e9 };
function signedIn(mustChangePassword: boolean) {
  return {
    session,
    user: { id: "org-1", username: "acme", mustChangePassword },
  };
}

function handler() {
  return vi.fn(async (..._args: unknown[]) => ({ success: true }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.checkRateLimit.mockResolvedValue(true);
  mocks.getSession.mockResolvedValue({ session: null, user: null });
});

describe("withAction", () => {
  it("refuses a user action without a session", async () => {
    const fn = handler();
    const action = withAction({ auth: "user" }, fn);

    expect(await action()).toEqual({ error: GENERIC_ERROR });
    expect(fn).not.toHaveBeenCalled();
  });

  it("refuses an account that still has its default password", async () => {
    mocks.getSession.mockResolvedValue(signedIn(true));
    const fn = handler();
    const action = withAction({ auth: "user" }, fn);

    expect(await action()).toEqual({ error: PASSWORD_CHANGE_REQUIRED_ERROR });
    expect(fn).not.toHaveBeenCalled();
  });

  it("lets an action opt in to default-password accounts", async () => {
    mocks.getSession.mockResolvedValue(signedIn(true));
    const fn = handler();
    const action = withAction({ auth: "user", allowDefaultPassword: true }, fn);

    expect(await action()).toEqual({ success: true });
    expect(fn).toHaveBeenCalledOnce();
  });

  it("passes the signed-in org to the handler", async () => {
    mocks.getSession.mockResolvedValue(signedIn(false));
    const fn = handler();
    const action = withAction({ auth: "user" }, fn);

    expect(await action()).toEqual({ success: true });
    const ctx = fn.mock.calls[0]?.[1] as { user: { id: string } };
    expect(ctx.user.id).toBe("org-1");
  });

  it("checks an anonymous action's limiter before resolving the session", async () => {
    const fn = handler();
    const action = withAction(
      { auth: "none", rateLimit: { name: "message", key: () => "msg:ip" } },
      fn,
    );

    expect(await action()).toEqual({ success: true });
    const [limiterOrder = Infinity] =
      mocks.checkRateLimit.mock.invocationCallOrder;
    const [sessionOrder = -Infinity] =
      mocks.getSession.mock.invocationCallOrder;
    expect(limiterOrder).toBeLessThan(sessionOrder);
    const ctx = fn.mock.calls[0]?.[1] as { session: unknown };
    expect(ctx.session).toBeNull();
  });

  it("returns the rate limit error when the limiter refuses", async () => {
    mocks.getSession.mockResolvedValue(signedIn(false));
    mocks.checkRateLimit.mockResolvedValue(false);
    const fn = handler();
    const action = withAction(
      { auth: "user", rateLimit: { name: "write", key: () => "w:org-1" } },
      fn,
    );

    expect(await action()).toEqual({ error: "Too many requests" });
    expect(fn).not.toHaveBeenCalled();
  });

  it("rejects invalid input before resolving the session", async () => {
    const fn = handler();
    const action = withAction({ schema: z.string().min(1), auth: "user" }, fn);

    expect(await action("")).toEqual({ error: INVALID_INPUT_ERROR });
    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(fn).not.toHaveBeenCalled();
  });
});
