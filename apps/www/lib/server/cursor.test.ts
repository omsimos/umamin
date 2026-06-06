import { describe, expect, it } from "vitest";
import { parseCursor } from "./cursor";

describe("parseCursor", () => {
  it("parses a valid epochMs.id cursor", () => {
    const parsed = parseCursor("1780000000000.abc123");

    expect(parsed).toEqual({
      cursorId: "abc123",
      cursorDate: new Date(1780000000000),
    });
  });

  it("keeps separators inside the id intact", () => {
    const parsed = parseCursor("1780000000000.0.post-1");

    expect(parsed?.cursorId).toBe("0.post-1");
  });

  it("returns null for a missing cursor", () => {
    expect(parseCursor(null)).toBeNull();
    expect(parseCursor("")).toBeNull();
  });

  it("returns null when there is no separator or no timestamp part", () => {
    expect(parseCursor("1780000000000")).toBeNull();
    expect(parseCursor(".abc")).toBeNull();
  });

  it("returns null for a non-numeric timestamp instead of an Invalid Date", () => {
    expect(parseCursor("abc.def")).toBeNull();
    expect(parseCursor("12x34.id")).toBeNull();
    expect(parseCursor("Infinity.id")).toBeNull();
  });
});
