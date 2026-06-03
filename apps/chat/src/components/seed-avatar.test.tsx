import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SeedAvatar } from "./seed-avatar";

describe("SeedAvatar", () => {
  it("renders a dicebear avatar image for the seed", () => {
    render(<SeedAvatar seed="x" alias="NightOwl" />);
    const img = screen.getByLabelText("NightOwl").querySelector("img");
    expect(img?.getAttribute("src")).toMatch(/^data:image\/svg\+xml/);
  });

  it("applies a gradient background", () => {
    render(<SeedAvatar seed="x" alias="NightOwl" />);
    const el = screen.getByLabelText("NightOwl");
    expect(el.style.backgroundImage).toMatch(/linear-gradient/);
  });
});
