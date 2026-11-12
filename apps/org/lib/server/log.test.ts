import { DrizzleQueryError } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logServerError } from "./log";

describe("logServerError", () => {
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    spy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    spy.mockRestore();
  });

  it("logs a failed query's SQL and cause without its bound parameters", () => {
    const query = "update org set password_hash = ?";
    const err = new DrizzleQueryError(
      query,
      ["HASH-VALUE"],
      new Error("SQLITE_BUSY"),
    );

    logServerError("Action error:", err);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("Action error:", {
      query,
      cause: "SQLITE_BUSY",
    });
    expect(JSON.stringify(spy.mock.calls)).not.toContain("HASH-VALUE");
  });

  it("passes any other error through unchanged", () => {
    const err = new Error("boom");

    logServerError("Login error:", err);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[0]).toBe("Login error:");
    expect(spy.mock.calls[0]?.[1]).toBe(err);
  });
});
