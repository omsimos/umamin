import { render, screen } from "@testing-library/react";
import { Button, buttonVariants } from "@umamin/ui/components/button";
import { describe, expect, it } from "vitest";

describe("Button", () => {
  it("renders a button with its children and the button role", () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole("button", { name: "Click me" });
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveTextContent("Click me");
  });

  it("applies distinct variant classes per variant", () => {
    const def = buttonVariants();
    const destructive = buttonVariants({ variant: "destructive" });
    const outline = buttonVariants({ variant: "outline" });

    expect(destructive).not.toBe(def);
    expect(outline).not.toBe(def);
    expect(destructive).not.toBe(outline);

    expect(def).toContain("bg-primary");
    expect(destructive).toContain("bg-destructive");
    expect(outline).toContain("border");
  });

  it("renders the variant class on the DOM node", () => {
    render(<Button variant="destructive">danger</Button>);
    expect(screen.getByRole("button", { name: "danger" })).toHaveClass(
      "bg-destructive",
    );
  });

  it("applies distinct size classes per size", () => {
    const sm = buttonVariants({ size: "sm" });
    const lg = buttonVariants({ size: "lg" });
    const icon = buttonVariants({ size: "icon" });

    expect(sm).toContain("h-8");
    expect(lg).toContain("h-10");
    expect(icon).toContain("size-9");

    expect(sm).not.toBe(lg);
    expect(sm).not.toBe(icon);
    expect(lg).not.toBe(icon);
  });

  it("renders the child element instead of a button when asChild is set", () => {
    render(
      <Button asChild>
        <a href="/x">go</a>
      </Button>,
    );

    const link = screen.getByRole("link", { name: "go" });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/x");
    // Slot must not nest a <button> around the anchor.
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    // Variant classes still flow onto the merged child.
    expect(link).toHaveClass("bg-primary");
  });

  it("forwards the disabled attribute", () => {
    render(<Button disabled>nope</Button>);
    expect(screen.getByRole("button", { name: "nope" })).toBeDisabled();
  });

  it("merges a custom className with the variant classes", () => {
    render(<Button className="custom-x">styled</Button>);
    const button = screen.getByRole("button", { name: "styled" });
    expect(button).toHaveClass("custom-x");
    expect(button).toHaveClass("bg-primary");
  });

  // Guards the documented icon-shrink gotcha: SVG children are pinned to size-4.
  it("includes the [&_svg]:size-4 icon-shrink rule in the base classes", () => {
    expect(buttonVariants()).toContain("[&_svg:not([class*='size-'])]:size-4");
  });
});
