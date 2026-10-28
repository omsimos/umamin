import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RefetchErrorAlert } from "./refetch-error-alert";

describe("RefetchErrorAlert", () => {
  it("retries when the button is pressed", async () => {
    const onRetry = vi.fn();
    render(<RefetchErrorAlert onRetry={onRetry} />);

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("disables the button while a retry is running", async () => {
    const onRetry = vi.fn();
    render(<RefetchErrorAlert onRetry={onRetry} retrying />);

    const button = screen.getByRole("button", { name: "Try again" });
    await userEvent.click(button);

    expect(button).toBeDisabled();
    expect(onRetry).not.toHaveBeenCalled();
  });
});
