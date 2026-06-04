import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { ChatAnnouncement } from "./chat-announcement";

const DISMISSED_KEY = "umamin:chat-announcement-dismissed";

beforeEach(() => {
  localStorage.clear();
});

describe("ChatAnnouncement", () => {
  it("shows the announcement with a chat CTA when not dismissed", async () => {
    render(<ChatAnnouncement />);

    expect(await screen.findByText("Umamin Chat is here")).toBeInTheDocument();
    expect(
      screen.getByText("Anonymous chats, matched by your interests."),
    ).toBeInTheDocument();

    const cta = screen.getByRole("link", { name: /try it/i });
    expect(cta.getAttribute("href")).toContain("https://chat.umamin.link");
    expect(cta.getAttribute("href")).toContain("utm_content=announcement");
    expect(cta).toHaveAttribute("target", "_blank");
    expect(cta).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("dismisses on the close button and persists the dismissal", async () => {
    const user = userEvent.setup();
    render(<ChatAnnouncement />);

    await user.click(
      await screen.findByRole("button", { name: /dismiss announcement/i }),
    );

    expect(screen.queryByText("Umamin Chat is here")).not.toBeInTheDocument();
    expect(localStorage.getItem(DISMISSED_KEY)).toBe("1");
  });

  it("stays hidden when previously dismissed", () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    render(<ChatAnnouncement />);

    expect(screen.queryByText("Umamin Chat is here")).not.toBeInTheDocument();
  });
});
