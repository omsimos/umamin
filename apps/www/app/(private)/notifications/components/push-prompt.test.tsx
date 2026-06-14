import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PushState } from "@/hooks/use-push-notifications";
import { PushPrompt } from "./push-prompt";

vi.mock("@/hooks/use-push-notifications", () => ({
  usePushNotifications: vi.fn(),
}));

import { usePushNotifications } from "@/hooks/use-push-notifications";

const mockHook = vi.mocked(usePushNotifications);
const enable = vi.fn();

function mockState(state: PushState) {
  mockHook.mockReturnValue({
    state,
    enable,
    disable: vi.fn(),
    isPending: false,
  });
}

describe("PushPrompt", () => {
  beforeEach(() => {
    localStorage.clear();
    enable.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows the enable nudge only when push is off and undismissed", () => {
    mockState("off");
    render(<PushPrompt />);
    expect(screen.getByText("Turn on push notifications")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enable" })).toBeInTheDocument();
  });

  it.each<PushState>([
    "on",
    "denied",
    "ios-install",
    "unsupported",
    "loading",
  ])("renders nothing when state is %s", (state) => {
    mockState(state);
    const { container } = render(<PushPrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  it("stays hidden once previously dismissed", () => {
    localStorage.setItem("push-prompt-dismissed", "1");
    mockState("off");
    const { container } = render(<PushPrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  it("triggers the shared enable flow on click", () => {
    mockState("off");
    render(<PushPrompt />);
    fireEvent.click(screen.getByRole("button", { name: "Enable" }));
    expect(enable).toHaveBeenCalledTimes(1);
  });

  it("persists the dismissal and hides on dismiss", () => {
    mockState("off");
    const { container } = render(<PushPrompt />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(localStorage.getItem("push-prompt-dismissed")).toBe("1");
    expect(container).toBeEmptyDOMElement();
  });
});
