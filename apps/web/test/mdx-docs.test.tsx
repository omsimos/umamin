import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ChildSafety from "@/markdown/child-safety.mdx";
import Privacy from "@/markdown/privacy.mdx";
import TermsOfService from "@/markdown/terms.mdx";

// Build-pipeline guard, not a content test: /privacy, /terms and /child-safety
// import markdown as React components, which only works while @mdx-js/rollup
// stays ahead of viteReact in vite.config.ts. Reorder them and all three routes
// break with nothing else to catch it.
describe("MDX doc pipeline", () => {
  it.each([
    ["Privacy Policy", Privacy],
    ["Terms of Service", TermsOfService],
    ["Child Safety Standards", ChildSafety],
  ])("compiles and renders %s", (heading, Doc) => {
    render(<Doc />);
    expect(
      screen.getByRole("heading", { level: 1, name: heading }),
    ).toBeInTheDocument();
  });
});
