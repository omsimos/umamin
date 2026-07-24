import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const callAction = vi.fn();
vi.mock("@/lib/api", () => ({
  callAction: (name: string, input?: unknown) => callAction(name, input),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (m: string) => toastSuccess(m),
    error: (m: string) => toastError(m),
  },
}));

import { BanUserDialog } from "./ban-user-dialog";

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("BanUserDialog", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("bans via banUserAction with an optional reason", async () => {
    callAction.mockResolvedValue({ success: true });
    const onOpenChange = vi.fn();

    render(
      <BanUserDialog
        username="griefer"
        banned={false}
        open
        onOpenChange={onOpenChange}
      />,
      { wrapper: wrapper(new QueryClient()) },
    );

    await userEvent.type(screen.getByLabelText(/reason/i), "spamming the feed");
    await userEvent.click(screen.getByRole("button", { name: "Ban" }));

    await waitFor(() => {
      expect(callAction).toHaveBeenCalledWith("banUserAction", {
        username: "griefer",
        reason: "spamming the feed",
      });
    });
    expect(toastSuccess).toHaveBeenCalledWith("User banned.");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("unbans via unbanUserAction when already banned", async () => {
    callAction.mockResolvedValue({ success: true });

    render(
      <BanUserDialog username="griefer" banned open onOpenChange={() => {}} />,
      { wrapper: wrapper(new QueryClient()) },
    );

    await userEvent.click(screen.getByRole("button", { name: "Unban" }));

    await waitFor(() => {
      expect(callAction).toHaveBeenCalledWith("unbanUserAction", {
        username: "griefer",
      });
    });
    expect(toastSuccess).toHaveBeenCalledWith("User unbanned.");
  });

  it("shows the action's error message on failure", async () => {
    callAction.mockResolvedValue({ error: "Not authorized" });

    render(
      <BanUserDialog
        username="griefer"
        banned={false}
        open
        onOpenChange={() => {}}
      />,
      { wrapper: wrapper(new QueryClient()) },
    );

    await userEvent.click(screen.getByRole("button", { name: "Ban" }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Not authorized");
    });
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
