import { afterEach, describe, expect, it, vi } from "vitest";

// The roster is parsed once at module load, so each case stubs the env and
// re-imports a fresh module copy.
async function loadIsModerator(roster: string) {
  vi.resetModules();
  vi.stubEnv("MODERATOR_USERS", roster);
  const mod = await import("./moderation");
  return mod.isModerator;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("isModerator", () => {
  it("admits exactly the usernames on the roster", async () => {
    const isModerator = await loadIsModerator("joshxfi,alice");
    expect(isModerator({ username: "joshxfi" })).toBe(true);
    expect(isModerator({ username: "alice" })).toBe(true);
    expect(isModerator({ username: "mallory" })).toBe(false);
  });

  it("treats an empty/unset roster as nobody", async () => {
    const isModerator = await loadIsModerator("");
    expect(isModerator({ username: "joshxfi" })).toBe(false);
  });

  it("trims whitespace and drops empty entries", async () => {
    const isModerator = await loadIsModerator(" alice , bob ,, ");
    expect(isModerator({ username: "alice" })).toBe(true);
    expect(isModerator({ username: "bob" })).toBe(true);
    // An empty entry must never collapse to "match the empty username".
    expect(isModerator({ username: "" })).toBe(false);
  });

  it("is case-sensitive (usernames are stored lowercased)", async () => {
    const isModerator = await loadIsModerator("joshxfi");
    expect(isModerator({ username: "JoshXFI" })).toBe(false);
  });

  it("rejects null/undefined and missing usernames", async () => {
    const isModerator = await loadIsModerator("joshxfi");
    expect(isModerator(null)).toBe(false);
    expect(isModerator(undefined)).toBe(false);
    expect(isModerator({ username: "" })).toBe(false);
  });
});
