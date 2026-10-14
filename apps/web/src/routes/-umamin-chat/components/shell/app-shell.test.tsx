import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AppShell } from "./app-shell";

describe("AppShell", () => {
  it("closes the open menu drawer when the session menu goes away", async () => {
    const { rerender } = render(
      <AppShell rail={<button type="button">New match</button>}>body</AppShell>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    // "New match" keeps the session page mounted and moves to the radar.
    rerender(<AppShell rail={null}>body</AppShell>);

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.queryByRole("button", { name: "Open menu" })).toBeNull();
  });
});
