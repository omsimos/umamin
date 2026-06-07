import { beforeEach, describe, expect, it, vi } from "vitest";
import * as z from "zod";

const getSession = vi.fn();
vi.mock("@/lib/auth", () => ({
  getSession: () => getSession(),
}));

const checkRateLimit = vi.fn();
vi.mock("@/lib/ratelimit", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimit(...args),
  RATE_LIMIT_ERROR: "Too many requests",
}));

import { redirect } from "next/navigation";
import { GENERIC_ERROR, INVALID_INPUT_ERROR } from "./errors";
import { withAction } from "./with-action";

const session = { id: "sess-1", userId: "user-1" };
const user = { id: "user-1", username: "josh" };

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue({ session, user });
  checkRateLimit.mockResolvedValue(true);
});

describe("withAction", () => {
  it("parses input and passes data + ctx to the handler", async () => {
    const handler = vi.fn(async (input: { id: string }) => ({
      success: true,
      id: input.id,
    }));
    const action = withAction(
      { schema: z.object({ id: z.string().min(1) }) },
      handler,
    );

    const res = await action({ id: "post-1" });

    expect(res).toEqual({ success: true, id: "post-1" });
    expect(handler).toHaveBeenCalledWith({ id: "post-1" }, { session, user });
  });

  it("returns the default invalid-input error on parse failure", async () => {
    const handler = vi.fn();
    const action = withAction(
      { schema: z.object({ id: z.string().min(1) }) },
      handler,
    );

    expect(await action({ id: "" })).toEqual({ error: INVALID_INPUT_ERROR });
    expect(handler).not.toHaveBeenCalled();
    expect(getSession).not.toHaveBeenCalled();
  });

  it("supports a custom invalid-input string and a ZodError mapper", async () => {
    const schema = z.object({
      content: z.string().min(1, { error: "Content cannot be empty" }),
    });

    const fixed = withAction(
      { schema, invalidInput: "Bad request" },
      async () => ({ success: true }),
    );
    expect(await fixed({ content: "" })).toEqual({ error: "Bad request" });

    const mapped = withAction(
      { schema, invalidInput: (error) => error.issues[0].message },
      async () => ({ success: true }),
    );
    expect(await mapped({ content: "" })).toEqual({
      error: "Content cannot be empty",
    });
  });

  it("guards the session with the default and custom auth errors", async () => {
    getSession.mockResolvedValue({ session: null, user: null });
    const handler = vi.fn();

    const action = withAction({}, handler);
    expect(await action(undefined)).toEqual({ error: GENERIC_ERROR });

    const custom = withAction({ authError: "User not authenticated" }, handler);
    expect(await custom(undefined)).toEqual({
      error: "User not authenticated",
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it('auth: "session" admits a session without a hydrated user', async () => {
    getSession.mockResolvedValue({ session, user: null });
    const action = withAction({}, async (_input, ctx) => ({
      userId: ctx.session.userId,
    }));

    expect(await action(undefined)).toEqual({ userId: "user-1" });
  });

  it('auth: "user" rejects a session without a hydrated user', async () => {
    getSession.mockResolvedValue({ session, user: null });
    const handler = vi.fn();
    const action = withAction({ auth: "user" }, handler);

    expect(await action(undefined)).toEqual({ error: GENERIC_ERROR });
    expect(handler).not.toHaveBeenCalled();
  });

  it('auth: "none" admits anonymous callers', async () => {
    getSession.mockResolvedValue({ session: null, user: null });
    const action = withAction({ auth: "none" }, async (_input, ctx) => ({
      anonymous: ctx.session === null,
    }));

    expect(await action(undefined)).toEqual({ anonymous: true });
  });

  it("rate limits with a ctx-derived key before calling the handler", async () => {
    checkRateLimit.mockResolvedValue(false);
    const handler = vi.fn();
    const action = withAction(
      {
        rateLimit: {
          name: "write",
          key: ({ session: s }) => `note:${s.userId}`,
        },
      },
      handler,
    );

    expect(await action(undefined)).toEqual({ error: "Too many requests" });
    expect(checkRateLimit).toHaveBeenCalledWith("write", "note:user-1");
    expect(handler).not.toHaveBeenCalled();
  });

  it('auth: "none" rate limits BEFORE the session lookup', async () => {
    const order: string[] = [];
    getSession.mockImplementation(async () => {
      order.push("getSession");
      return { session: null, user: null };
    });
    checkRateLimit.mockImplementation(async () => {
      order.push("checkRateLimit");
      return true;
    });

    const action = withAction(
      { auth: "none", rateLimit: { name: "message", key: () => "msg:ip" } },
      async () => ({ success: true }),
    );

    expect(await action(undefined)).toEqual({ success: true });
    expect(order).toEqual(["checkRateLimit", "getSession"]);
  });

  it("returns the generic catch error and honors a custom errorMessage", async () => {
    const boom = async () => {
      throw new Error("db down");
    };

    expect(await withAction({}, boom)(undefined)).toEqual({
      error: GENERIC_ERROR,
    });
    expect(
      await withAction(
        { errorMessage: "Failed to create note" },
        boom,
      )(undefined),
    ).toEqual({ error: "Failed to create note" });
  });

  it("maps specific errors via onError and falls through otherwise", async () => {
    const action = withAction(
      {
        onError: (err) =>
          err instanceof Error && err.message === "dup"
            ? { error: "Username already exists" }
            : undefined,
      },
      async () => {
        throw new Error("dup");
      },
    );
    expect(await action(undefined)).toEqual({
      error: "Username already exists",
    });

    const fallthrough = withAction({ onError: () => undefined }, async () => {
      throw new Error("other");
    });
    expect(await fallthrough(undefined)).toEqual({ error: GENERIC_ERROR });
  });

  it("rethrows redirect() instead of swallowing it into { error }", async () => {
    const action = withAction({}, async () => {
      redirect("/login");
    });

    await expect(action(undefined)).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
  });
});
