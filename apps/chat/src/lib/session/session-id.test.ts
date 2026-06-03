import { beforeEach, describe, expect, it } from "vitest";
import { getSessionId } from "./session-id";

describe("getSessionId", () => {
  beforeEach(() => localStorage.clear());
  it("creates and persists a stable id", () => {
    const a = getSessionId();
    expect(a).toMatch(/.+/);
    expect(getSessionId()).toBe(a);
  });
});
