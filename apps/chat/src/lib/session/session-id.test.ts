import { beforeEach, describe, expect, it } from "vitest";
import { getSessionCredentials, getSessionId } from "./session-id";

describe("getSessionId", () => {
  beforeEach(() => localStorage.clear());
  it("creates and persists a stable id", () => {
    const a = getSessionId();
    expect(a).toMatch(/.+/);
    expect(getSessionId()).toBe(a);
  });

  it("creates and persists a stable secret with the id", () => {
    const a = getSessionCredentials();
    expect(a.sessionId).toMatch(/.+/);
    expect(a.sessionSecret).toMatch(/.+/);
    expect(getSessionCredentials()).toEqual(a);
  });
});
