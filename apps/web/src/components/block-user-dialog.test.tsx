import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// The action-client (@/lib/actions) calls callAction from @/lib/api; mocking it
// here exercises the full mutation flow (button → mutationFn → onSuccess/onError
// → toast + cache invalidation) without a network or Hono handler.
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

import { BlockUserDialog } from "./block-user-dialog";

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("BlockUserDialog", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("calls blockUserAction with the target id and confirms with a toast", async () => {
    callAction.mockResolvedValue({ success: true });
    const client = new QueryClient();
    const onBlocked = vi.fn();

    render(
      <BlockUserDialog
        userId="user_9"
        username="mallory"
        open
        onOpenChange={() => {}}
        onBlocked={onBlocked}
      />,
      { wrapper: wrapper(client) },
    );

    await userEvent.click(screen.getByRole("button", { name: "Block" }));

    await waitFor(() => {
      expect(callAction).toHaveBeenCalledWith("blockUserAction", {
        userId: "user_9",
      });
    });
    expect(toastSuccess).toHaveBeenCalledWith("User blocked.");
    expect(onBlocked).toHaveBeenCalledTimes(1);
    expect(toastError).not.toHaveBeenCalled();
  });

  it("surfaces an error toast when the action returns { error }", async () => {
    callAction.mockResolvedValue({ error: "Rate limited" });
    const client = new QueryClient();

    render(<BlockUserDialog userId="user_9" open onOpenChange={() => {}} />, {
      wrapper: wrapper(client),
    });

    await userEvent.click(screen.getByRole("button", { name: "Block" }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Couldn't block user.");
    });
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
