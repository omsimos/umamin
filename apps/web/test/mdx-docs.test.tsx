import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ChildSafety from "@/markdown/child-safety.mdx";
import Privacy from "@/markdown/privacy.mdx";
import TermsOfService from "@/markdown/terms.mdx";

// Smoke test for the MDX pipeline (@mdx-js/rollup + remark-gfm): each doc route
// (/privacy, /terms, /child-safety) imports its markdown as a React component
// and renders its top-level heading. Proves MDX compiles + renders under jsdom.
describe("MDX doc pages", () => {
  it("renders the Privacy Policy heading", () => {
    render(<Privacy />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Privacy Policy" }),
    ).toBeInTheDocument();
  });

  it("renders the Terms of Service heading", () => {
    render(<TermsOfService />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Terms of Service" }),
    ).toBeInTheDocument();
  });

  it("renders the Child Safety Standards heading", () => {
    render(<ChildSafety />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Child Safety Standards" }),
    ).toBeInTheDocument();
  });
});
