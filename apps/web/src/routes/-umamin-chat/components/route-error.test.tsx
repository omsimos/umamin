import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RouteError } from "./route-error";

describe("RouteError", () => {
  it("renders a recoverable fallback and resets the boundary on Try again", async () => {
    const reset = vi.fn();
    render(
      <RouteError
        error={new Error("boom")}
        reset={reset}
        info={{ componentStack: "" }}
      />,
    );
    expect(
      screen.getByRole("heading", { name: /something went wrong/i }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
