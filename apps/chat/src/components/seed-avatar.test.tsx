import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SeedAvatar } from "./seed-avatar";

describe("SeedAvatar", () => {
  it("renders the alias initial", () => {
    render(<SeedAvatar seed="x" alias="NightOwl" />);
    expect(screen.getByText("N")).toBeInTheDocument();
  });

  it("applies a gradient background", () => {
    render(<SeedAvatar seed="x" alias="NightOwl" />);
    const el = screen.getByLabelText("NightOwl");
    expect(el.style.backgroundImage).toMatch(/linear-gradient/);
  });
});
