import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: (m: string) => toastSuccess(m) },
}));

import CopyLink from "./copy-link";

describe("CopyLink", () => {
  const writeText = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    writeText.mockClear();
    toastSuccess.mockClear();
    // navigator.clipboard is a getter-only prop in jsdom, so define it.
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    // jsdom's default origin; assert against it rather than hardcoding.
    window.history.replaceState({}, "", "/");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the share URL with the scheme stripped", () => {
    render(<CopyLink username="alice" />);
    const origin = window.location.origin.replace(/(^\w+:|^)\/\//, "");
    expect(screen.getByText(`${origin}/to/alice`)).toBeInTheDocument();
  });

  // fireEvent (not userEvent) so the component's navigator.clipboard stub
  // isn't clobbered by userEvent.setup()'s own clipboard override.
  it("copies the full origin-qualified URL to the clipboard on click", () => {
    render(<CopyLink username="bob" />);

    fireEvent.click(screen.getByRole("button"));

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/to/bob`);
  });

  it("confirms the copy with a success toast", () => {
    render(<CopyLink username="carol" />);

    fireEvent.click(screen.getByRole("button"));

    expect(toastSuccess).toHaveBeenCalledWith("Copied.");
  });
});
