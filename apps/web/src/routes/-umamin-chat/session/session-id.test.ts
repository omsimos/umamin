import { beforeEach, describe, expect, it } from "vitest";
import { getSessionCredentials } from "./session-id";

describe("getSessionCredentials", () => {
  beforeEach(() => localStorage.clear());

  it("creates and persists a stable id", () => {
    const a = getSessionCredentials();
    expect(a.sessionId).toMatch(/.+/);
    expect(getSessionCredentials().sessionId).toBe(a.sessionId);
  });

  it("creates and persists a stable secret with the id", () => {
    const a = getSessionCredentials();
    expect(a.sessionId).toMatch(/.+/);
    expect(a.sessionSecret).toMatch(/.+/);
    expect(getSessionCredentials()).toEqual(a);
  });
});
