import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  canGoBack: false,
  back: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useCanGoBack: () => mocks.canGoBack,
  useRouter: () => ({ history: { back: mocks.back } }),
}));
vi.mock("@/lib/navigation", () => ({
  Link: () => null,
  useAppNavigate: () => mocks.navigate,
}));
vi.mock("@/lib/actions", () => ({
  blockUserAction: vi.fn(),
  hideDmThreadAction: vi.fn(),
}));

import { BackToChats } from "./conversation";

describe("BackToChats", () => {
  beforeEach(() => {
    mocks.back.mockClear();
    mocks.navigate.mockClear();
  });

  it("goes back in history when the previous entry is in the app", async () => {
    mocks.canGoBack = true;
    render(<BackToChats />);
    await userEvent.click(
      screen.getByRole("button", { name: "Back to chats" }),
    );
    expect(mocks.back).toHaveBeenCalledTimes(1);
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("replaces with the chats list on a cold open", async () => {
    mocks.canGoBack = false;
    render(<BackToChats />);
    await userEvent.click(
      screen.getByRole("button", { name: "Back to chats" }),
    );
    expect(mocks.back).not.toHaveBeenCalled();
    expect(mocks.navigate).toHaveBeenCalledWith("/inbox?tab=chats", {
      replace: true,
    });
  });
});
