import { describe, expect, it } from "vitest";
import { formatContent, formatUsername } from "../src/lib/format";

describe("formatUsername", () => {
  it("strips a percent-encoded or decoded @ prefix", () => {
    expect(formatUsername("%40josh")).toBe("josh");
    expect(formatUsername("@josh")).toBe("josh");
    expect(formatUsername("josh")).toBe("josh");
  });
});

describe("formatContent", () => {
  it("collapses blank-line runs and trims the ends", () => {
    expect(formatContent("a\n\n\n\nb  ")).toBe("a\n\nb");
  });
});
