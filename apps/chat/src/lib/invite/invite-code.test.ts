import { beforeEach, describe, expect, it, vi } from "vitest";
import { getInviteCode } from "./invite-code";

describe("getInviteCode", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("generates a 10-char lowercase base36 code and persists it", () => {
    const code = getInviteCode();
    expect(code).toMatch(/^[0-9a-z]{10}$/);
    expect(localStorage.getItem("umamin-chat:inviteCode")).toBe(code);
  });

  it("is stable across calls", () => {
    expect(getInviteCode()).toBe(getInviteCode());
  });

  it("falls back to a memory code when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    const first = getInviteCode();
    expect(first).toMatch(/^[0-9a-z]{10}$/);
    expect(getInviteCode()).toBe(first);
  });
});
