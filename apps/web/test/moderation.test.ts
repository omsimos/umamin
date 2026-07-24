import { describe, expect, it } from "vitest";
import { isModerator, parseModerators } from "../src/server-lib/moderation";

// Ported from apps/www with the new pure signature: the roster is passed in
// (from env.MODERATOR_USERS) instead of read from process.env at module init,
// so each case just passes the roster string directly — no env stub / re-import.

describe("parseModerators", () => {
  it("trims whitespace and drops empty entries", () => {
    expect([...parseModerators(" alice , bob ,, ")]).toEqual(["alice", "bob"]);
  });

  it("treats an empty/unset roster as nobody", () => {
    expect(parseModerators("").size).toBe(0);
    expect(parseModerators(null).size).toBe(0);
    expect(parseModerators(undefined).size).toBe(0);
  });
});

describe("isModerator", () => {
  it("admits exactly the usernames on the roster", () => {
    expect(isModerator({ username: "joshxfi" }, "joshxfi,alice")).toBe(true);
    expect(isModerator({ username: "alice" }, "joshxfi,alice")).toBe(true);
    expect(isModerator({ username: "mallory" }, "joshxfi,alice")).toBe(false);
  });

  it("treats an empty/unset roster as nobody", () => {
    expect(isModerator({ username: "joshxfi" }, "")).toBe(false);
    expect(isModerator({ username: "joshxfi" }, null)).toBe(false);
  });

  it("trims whitespace and drops empty entries", () => {
    expect(isModerator({ username: "alice" }, " alice , bob ,, ")).toBe(true);
    expect(isModerator({ username: "bob" }, " alice , bob ,, ")).toBe(true);
    // An empty entry must never collapse to "match the empty username".
    expect(isModerator({ username: "" }, " alice , bob ,, ")).toBe(false);
  });

  it("is case-sensitive (usernames are stored lowercased)", () => {
    expect(isModerator({ username: "JoshXFI" }, "joshxfi")).toBe(false);
  });

  it("rejects null/undefined and missing usernames", () => {
    expect(isModerator(null, "joshxfi")).toBe(false);
    expect(isModerator(undefined, "joshxfi")).toBe(false);
    expect(isModerator({ username: "" }, "joshxfi")).toBe(false);
  });
});
