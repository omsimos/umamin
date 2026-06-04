import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DemoSocial } from "./demo-social";

describe("DemoSocial", () => {
  it("toggles the like count", async () => {
    const user = userEvent.setup();
    render(<DemoSocial />);

    const like = screen.getByRole("button", { name: "Like" });
    expect(like).toHaveTextContent("128");

    await user.click(like);
    expect(like).toHaveAttribute("aria-pressed", "true");
    expect(like).toHaveTextContent("129");

    await user.click(like);
    expect(like).toHaveTextContent("128");
  });

  it("toggles the repost count", async () => {
    const user = userEvent.setup();
    render(<DemoSocial />);

    const repost = screen.getByRole("button", { name: "Repost" });
    await user.click(repost);
    expect(repost).toHaveAttribute("aria-pressed", "true");
    expect(repost).toHaveTextContent("42");
  });
});
