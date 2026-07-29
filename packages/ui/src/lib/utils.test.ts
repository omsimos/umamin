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

  it("keeps a shorthand that the longhand does not fully override", () => {
    // px-4 narrows p-2 rather than replacing it — dropping p-2 here would
    // silently remove vertical padding across the app.
    expect(cn("p-2", "px-4")).toBe("p-2 px-4");
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });

  // `cn` is cnfast, not twMerge(clsx(…)) — see utils.ts. Its merge tables are
  // the part that can drift on a version bump, and Tailwind v4 syntax is where
  // a table built for v3 would quietly stop recognising conflicts (leaving BOTH
  // classes, so whichever CSS rule happens to win decides the layout). These
  // pin the v4 groups this codebase actually uses.
  describe("Tailwind v4 syntax", () => {
    it.each([
      ["size-4", "size-8", "size-8"],
      ["shadow-xs", "shadow-sm", "shadow-sm"],
      ["rounded-sm", "rounded-xs", "rounded-xs"],
      ["outline-hidden", "outline-none", "outline-none"],
      ["inset-ring", "inset-ring-2", "inset-ring-2"],
      ["field-sizing-content", "field-sizing-fixed", "field-sizing-fixed"],
      // opacity modifiers
      ["bg-red-500/50", "bg-blue-500/80", "bg-blue-500/80"],
      ["dark:bg-black/40", "dark:bg-white/10", "dark:bg-white/10"],
      // CSS-variable shorthand
      ["text-(--brand)", "text-(--other)", "text-(--other)"],
      // arbitrary values + arbitrary variants (the `[&_svg]:size-4` gotcha)
      ["grid-cols-[1fr_2fr]", "grid-cols-3", "grid-cols-3"],
      ["[&_svg]:size-4", "[&_svg]:size-5", "[&_svg]:size-5"],
      // v4 variants
      ["@max-md:flex", "@max-md:hidden", "@max-md:hidden"],
      [
        "not-hover:opacity-50",
        "not-hover:opacity-100",
        "not-hover:opacity-100",
      ],
      ["starting:opacity-0", "starting:opacity-100", "starting:opacity-100"],
    ])("resolves %s + %s to %s", (a, b, expected) => {
      expect(cn(a, b)).toBe(expected);
    });

    it("does not merge across different variants", () => {
      expect(cn("hover:px-2", "px-4")).toBe("hover:px-2 px-4");
      expect(cn("md:hidden", "hidden")).toBe("md:hidden hidden");
    });
  });
});
