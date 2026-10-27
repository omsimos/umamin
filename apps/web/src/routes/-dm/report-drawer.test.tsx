import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReportDrawer } from "./report-drawer";

describe("ReportDrawer", () => {
  it("moves focus into the drawer when it opens", async () => {
    const { rerender } = render(
      <>
        <button type="button">bubble</button>
        <ReportDrawer
          open={false}
          onOpenChange={vi.fn()}
          peerName="bob"
          onSubmit={vi.fn()}
        />
      </>,
    );
    screen.getByRole("button", { name: "bubble" }).focus();

    rerender(
      <>
        <button type="button">bubble</button>
        <ReportDrawer
          open
          onOpenChange={vi.fn()}
          peerName="bob"
          onSubmit={vi.fn()}
        />
      </>,
    );

    const drawer = await screen.findByRole("dialog", {
      name: "Report message",
    });
    await waitFor(() =>
      expect(drawer).toContainElement(document.activeElement as HTMLElement),
    );
  });
});
