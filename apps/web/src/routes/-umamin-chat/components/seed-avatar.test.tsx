import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SeedAvatar } from "./seed-avatar";

describe("SeedAvatar", () => {
  // The data: URI is the point: avatars are generated client-side rather than
  // fetched from an HTTP avatar service, which keeps them working offline and
  // in tests and stops a seed leaking to a third party. An `https://` src here
  // means someone swapped in a remote service.
  it("generates the avatar locally as a data URI, not an API request", () => {
    render(<SeedAvatar seed="x" alias="NightOwl" />);
    const img = screen.getByLabelText("NightOwl").querySelector("img");
    expect(img?.getAttribute("src")).toMatch(/^data:image\/svg\+xml/);
  });
});
