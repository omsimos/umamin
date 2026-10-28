import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CommunityWall } from "./community-wall";

describe("CommunityWall", () => {
  it("lets the visitor pause and resume the scroll", async () => {
    const user = userEvent.setup();
    const { container } = render(<CommunityWall />);
    const columns = () =>
      container.querySelectorAll<HTMLElement>(".animate-scroll-up");

    const pause = screen.getByRole("button", { name: "Pause example posts" });
    expect(pause).toHaveAttribute("aria-pressed", "false");
    for (const column of columns()) {
      expect(column).not.toHaveClass("[animation-play-state:paused]");
    }

    await user.click(pause);

    const play = screen.getByRole("button", { name: "Play example posts" });
    expect(play).toHaveAttribute("aria-pressed", "true");
    for (const column of columns()) {
      expect(column).toHaveClass("[animation-play-state:paused]");
    }

    await user.click(play);
    expect(
      screen.getByRole("button", { name: "Pause example posts" }),
    ).toHaveAttribute("aria-pressed", "false");
  });
});
