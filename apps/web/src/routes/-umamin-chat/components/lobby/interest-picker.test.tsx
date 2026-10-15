import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { InterestPicker } from "./interest-picker";

describe("InterestPicker", () => {
  it("toggles an interest when a chip is clicked", async () => {
    const onToggle = vi.fn();
    render(<InterestPicker selected={[]} onToggle={onToggle} />);
    await userEvent.click(screen.getByRole("button", { name: /Music/ }));
    expect(onToggle).toHaveBeenCalledWith("music");
  });

  it("marks selected chips as pressed", () => {
    render(<InterestPicker selected={["gaming"]} onToggle={() => {}} />);
    expect(screen.getByRole("button", { name: /Gaming/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
