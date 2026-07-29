import { describe, expect, it } from "vitest";
// Extension required: the package is "type": "module" on moduleResolution
// NodeNext, so a bare relative specifier is a TS2835 error.
import { cn } from "./utils.js";

describe("cn", () => {
  it("joins plain class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("drops falsy conditional classes", () => {
    expect(cn("a", false && "b", null, undefined, "c")).toBe("a c");
  });

  it("merges conflicting tailwind utilities, last wins", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-sm", "text-lg")).toBe("text-lg");
  });

  it("supports array and object class inputs", () => {
    expect(cn(["a", "b"], { c: true, d: false })).toBe("a b c");
  });
});
