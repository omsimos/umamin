import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatPromo } from "./chat-promo";

// jsdom has no matchMedia; pin the promo to its desktop (Dialog) variant.
vi.mock("@/hooks/use-media-query", () => ({
  useMediaQuery: () => true,
}));

const SEEN_KEY = "umamin:chat-promo-seen";

beforeEach(() => {
  localStorage.clear();
});

describe("ChatPromo", () => {
  it("shows the new-dot until the promo is opened, then persists seen", async () => {
    const user = userEvent.setup();
    render(<ChatPromo />);

    expect(await screen.findByTestId("chat-promo-new-dot")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /about umamin chat/i }),
    );

    expect(screen.queryByTestId("chat-promo-new-dot")).not.toBeInTheDocument();
    expect(localStorage.getItem(SEEN_KEY)).toBe("1");

    const cta = screen.getByRole("link", { name: /start chatting/i });
    expect(cta.getAttribute("href")).toContain("utm_content=nav");
  });

  it("does not show the dot when the promo was already seen", () => {
    localStorage.setItem(SEEN_KEY, "1");
    render(<ChatPromo />);

    expect(screen.queryByTestId("chat-promo-new-dot")).not.toBeInTheDocument();
  });
});
