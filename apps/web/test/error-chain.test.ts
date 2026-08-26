import { describe, expect, it } from "vitest";
import {
  formatErrorChain,
  isForeignKeyConstraintViolation,
  isUniqueConstraintViolation,
} from "../src/server-lib/errors";

// Rebuild the shape that made a total Turso outage unreadable in Workers Logs:
// drizzle wraps the driver error and calls Error.captureStackTrace, so `stack`
// carries no message line, and workerd's console logs `stack` alone.
class DrizzleQueryErrorLike extends Error {
  constructor(query: string, cause: unknown) {
    super(`Failed query: ${query}\nparams: `);
    this.cause = cause;
    this.stack =
      "    at LibSQLPreparedQuery.queryWithCache (index.js:24623:10)";
  }
}

class LibsqlErrorLike extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "LibsqlError";
    this.code = code;
  }
}

describe("formatErrorChain", () => {
  it("surfaces the cause's message and code from a message-less wrapper stack", () => {
    const error = new DrizzleQueryErrorLike(
      "select * from session",
      new LibsqlErrorLike("Server returned HTTP status 401", "SERVER_ERROR"),
    );

    const out = formatErrorChain(error);

    // What logging the raw error lost: the reason and the driver's code.
    expect(out).toContain(
      "caused by: LibsqlError: Server returned HTTP status 401 [SERVER_ERROR]",
    );
    // The wrapper's frames still survive, so the failing call site is locatable.
    expect(out).toContain("queryWithCache");
  });

  it("truncates a link's message so bound params can't be logged in full", () => {
    const secret = "x".repeat(400);
    const out = formatErrorChain(new Error(`Failed query: ${secret}`));

    expect(out).not.toContain(secret);
    expect(out).toContain("…");
  });

  it("stops on a cyclic cause chain", () => {
    const outer = new Error("outer");
    const inner = new Error("inner");
    outer.cause = inner;
    inner.cause = outer;

    const out = formatErrorChain(outer);

    expect(out.match(/inner/g)).toHaveLength(1);
  });

  it("describes a thrown non-Error", () => {
    expect(formatErrorChain({ code: "boom" })).toBe('{"code":"boom"}');
    expect(formatErrorChain(undefined)).toBe("");
  });
});

// The shape a reaction on an already-deleted note arrives as: drizzle's wrapper
// around the libsql transaction error. Production saw 5 of these before the
// client stopped sending optimistic ids (2026-08-23).
const constraintError = (message: string) =>
  new DrizzleQueryErrorLike(
    'insert into "note_reaction" ("id", "note_id") values (?, ?)',
    new LibsqlErrorLike(message, "SQLITE_CONSTRAINT"),
  );

describe("constraint violation matchers", () => {
  it("recognizes a FOREIGN KEY failure through the drizzle wrapper", () => {
    expect(
      isForeignKeyConstraintViolation(
        constraintError(
          "SQLITE_CONSTRAINT: SQLite error: FOREIGN KEY constraint failed",
        ),
      ),
    ).toBe(true);
  });

  it("does not confuse a unique violation for a foreign-key one", () => {
    const unique = constraintError(
      "SQLITE_CONSTRAINT: SQLite error: UNIQUE constraint failed: user.username",
    );

    expect(isForeignKeyConstraintViolation(unique)).toBe(false);
    expect(isUniqueConstraintViolation(unique, "user.username")).toBe(true);
  });

  it("ignores a non-constraint driver failure with a matching message", () => {
    // A Turso 401 carries no constraint code, so neither matcher may claim it —
    // otherwise an outage would be reported to users as a missing row.
    const unauthorized = new DrizzleQueryErrorLike(
      'insert into "note_reaction" ("id") values (?)',
      new LibsqlErrorLike("FOREIGN KEY constraint failed", "SERVER_ERROR"),
    );

    expect(isForeignKeyConstraintViolation(unauthorized)).toBe(false);
  });
});
