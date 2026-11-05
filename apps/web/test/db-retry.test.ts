import { LibsqlError } from "@libsql/client";
import { userTable } from "@umamin/db/schema/user";
import { drizzle } from "drizzle-orm/libsql/web";
import { describe, expect, it, vi } from "vitest";
import {
  isTransientDbError,
  retryTransientRead,
} from "../src/server-lib/db-retry";

// The driver probes the server version with a GET first, then POSTs the query
// pipeline. Only the POST is under test.
function dbAnswering(post: () => Response) {
  return drizzle({
    connection: {
      url: "http://db.test",
      fetch: async (request: Request) =>
        request.method === "GET" ? new Response("") : post(),
    },
  });
}

// Runs a real query through the real driver so the classifier sees the exact
// error chain production throws, not a hand-built imitation.
async function errorFrom(post: () => Response): Promise<unknown> {
  try {
    await dbAnswering(post).select().from(userTable).limit(1);
  } catch (error) {
    return error;
  }
  throw new Error("expected the query to fail");
}

function statusResponse(status: number) {
  return () =>
    new Response("upstream failed", {
      status,
      headers: { "content-type": "text/plain" },
    });
}

describe("isTransientDbError", () => {
  it.each([502, 503, 504, 520])(
    "retries a driver error for HTTP %i",
    async (status) => {
      expect(isTransientDbError(await errorFrom(statusResponse(status)))).toBe(
        true,
      );
    },
  );

  it.each([400, 401, 500])(
    "does not retry a driver error for HTTP %i",
    async (status) => {
      expect(isTransientDbError(await errorFrom(statusResponse(status)))).toBe(
        false,
      );
    },
  );

  it("retries a truncated JSON body from the driver", async () => {
    const error = await errorFrom(
      () =>
        new Response('{"baton":null,"results":[{"type":"ok"', {
          headers: { "content-type": "application/json" },
        }),
    );
    expect(isTransientDbError(error)).toBe(true);
  });

  it("reads the status from the message when the cause has none", () => {
    const error = new LibsqlError(
      "Server returned HTTP status 503",
      "SERVER_ERROR",
    );
    expect(isTransientDbError(error)).toBe(true);
  });

  it("does not retry SQL errors or our own JSON bugs", () => {
    expect(
      isTransientDbError(
        new LibsqlError("UNIQUE constraint failed", "SQLITE_CONSTRAINT"),
      ),
    ).toBe(false);
    expect(
      isTransientDbError(new SyntaxError("Unexpected end of JSON input")),
    ).toBe(false);
    expect(isTransientDbError(new Error("boom"))).toBe(false);
  });
});

describe("retryTransientRead", () => {
  const transient = () =>
    new LibsqlError("Server returned HTTP status 502", "SERVER_ERROR");

  it("runs the read again after one transient failure", async () => {
    const run = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(transient())
      .mockResolvedValueOnce("rows");
    const onRetry = vi.fn();

    await expect(retryTransientRead(run, onRetry)).resolves.toBe("rows");
    expect(run).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("retries only once and throws the second failure", async () => {
    const second = transient();
    const run = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(transient())
      .mockRejectedValueOnce(second)
      .mockResolvedValue("never");

    await expect(retryTransientRead(run)).rejects.toBe(second);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("does not retry a non-transient failure", async () => {
    const error = new Error("no such column");
    const run = vi.fn<() => Promise<string>>().mockRejectedValue(error);
    const onRetry = vi.fn();

    await expect(retryTransientRead(run, onRetry)).rejects.toBe(error);
    expect(run).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });
});
