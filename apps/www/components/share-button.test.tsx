import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileShareMenu } from "./share-button";

vi.mock("@/lib/share-card/profile-card", () => ({
  renderProfileCard: vi.fn(async () => ({
    share: new Blob(["png"], { type: "image/png" }),
    preview: new Blob(["png-guide"], { type: "image/png" }),
  })),
}));

const USER = {
  username: "joshxfi",
  displayName: "Josh",
  bio: "hi",
  question: "Send me an anonymous message!",
  followerCount: 3,
};

describe("ProfileShareMenu", () => {
  beforeEach(() => {
    if (typeof URL.createObjectURL !== "function") {
      URL.createObjectURL = () => "blob:mock";
      URL.revokeObjectURL = () => {};
    }
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn(async () => {}) },
    });
  });

  it("offers the card and copy-link actions in a dropdown", async () => {
    render(<ProfileShareMenu user={USER} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Share profile" }),
    );
    expect(
      screen.getByRole("menuitem", { name: /Share your card/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Copy link/ }),
    ).toBeInTheDocument();
  });

  it("copies the profile URL", async () => {
    render(<ProfileShareMenu user={USER} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Share profile" }),
    );
    await userEvent.click(screen.getByRole("menuitem", { name: /Copy link/ }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("/user/joshxfi"),
    );
  });

  it("opens the card preview with share and save actions", async () => {
    render(<ProfileShareMenu user={USER} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Share profile" }),
    );
    await userEvent.click(
      screen.getByRole("menuitem", { name: /Share your card/ }),
    );
    expect(await screen.findByText("Your profile card")).toBeInTheDocument();
    expect(
      await screen.findByAltText("Preview of your profile card"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Share$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save/ })).toBeInTheDocument();
    // Copies the anon-inbox link for the story's link sticker.
    await userEvent.click(screen.getByRole("button", { name: /Copy link/ }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("/to/joshxfi"),
    );
  });
});
