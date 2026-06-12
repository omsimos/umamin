import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { InviteBanner } from "./invite-banner";

describe("InviteBanner", () => {
  it("shows generic invite copy and dismisses", async () => {
    const onDismiss = vi.fn();
    render(<InviteBanner onDismiss={onDismiss} />);
    expect(screen.getByText(/You were invited/)).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Dismiss invite" }),
    );
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
