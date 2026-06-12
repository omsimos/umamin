import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RevealState } from "../../../lib/session/types";
import { ConnectionSheet } from "./connection-sheet";

const SELF = { alias: "Calm Otter", avatarSeed: "self-seed" };
const PARTNER = { alias: "Blue Fox", avatarSeed: "partner-seed" };

// Desktop (dialog) path — vaul's drawer is exercised elsewhere; the body is
// identical in both shells.
const originalMatchMedia = window.matchMedia;
beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
});
afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

function reveal(overrides: Partial<RevealState> = {}): RevealState {
  return {
    unlocked: true,
    self: { submitted: false },
    partner: { submitted: false },
    ...overrides,
  };
}

function renderSheet(
  state: RevealState,
  handlers: Partial<{
    onSubmit: (handle: string) => void;
    onWithdraw: () => void;
    onOpenChange: (open: boolean) => void;
  }> = {},
) {
  return render(
    <ConnectionSheet
      open
      onOpenChange={handlers.onOpenChange ?? (() => {})}
      reveal={state}
      self={SELF}
      partner={PARTNER}
      onSubmit={handlers.onSubmit ?? (() => {})}
      onWithdraw={handlers.onWithdraw ?? (() => {})}
    />,
  );
}

describe("ConnectionSheet", () => {
  it("submits a trimmed handle", async () => {
    const onSubmit = vi.fn();
    renderSheet(reveal(), { onSubmit });
    await userEvent.type(
      screen.getByRole("textbox", { name: "Your handle" }),
      "  @otter  ",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Share my handle" }),
    );
    expect(onSubmit).toHaveBeenCalledWith("@otter");
  });

  it("teases when the partner already shared — without showing what", () => {
    renderSheet(reveal({ partner: { submitted: true } }));
    expect(screen.getByText(/Blue Fox has already shared/)).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Your handle" }),
    ).toBeInTheDocument();
  });

  it("shows the waiting state with a withdraw after submitting", async () => {
    const onWithdraw = vi.fn();
    renderSheet(reveal({ self: { submitted: true, handle: "@otter" } }), {
      onWithdraw,
    });
    expect(screen.getByText(/waiting for Blue Fox/)).toBeInTheDocument();
    expect(screen.getByText("@otter")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Take it back" }));
    expect(onWithdraw).toHaveBeenCalledTimes(1);
  });

  it("pins both handles once mutually revealed", () => {
    renderSheet(
      reveal({
        self: { submitted: true, handle: "@otter" },
        partner: { submitted: true, handle: "@fox" },
      }),
    );
    expect(screen.getByText("@otter")).toBeInTheDocument();
    expect(screen.getByText("@fox")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copy Blue Fox's handle" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});
