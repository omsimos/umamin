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

import { PasswordForm } from "@/routes/-settings/password-form";

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("PasswordForm", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("sets a password via updatePasswordAction on valid matching input", async () => {
    callAction.mockResolvedValue({ success: true });
    const client = new QueryClient();
    const user = userEvent.setup();

    render(<PasswordForm hasPassword={false} />, {
      wrapper: wrapper(client),
    });

    await user.type(screen.getByLabelText("New Password"), "sup3rsecret!");
    await user.type(
      screen.getByLabelText("Confirm New Password"),
      "sup3rsecret!",
    );
    await user.click(screen.getByRole("button", { name: /set password/i }));

    await waitFor(() => {
      expect(callAction).toHaveBeenCalledWith("updatePasswordAction", {
        currentPassword: "",
        newPassword: "sup3rsecret!",
        confirmPassword: "sup3rsecret!",
      });
    });
    expect(toastSuccess).toHaveBeenCalledWith("Password updated.");
  });

  it("shows a validation error and does not call the action when passwords mismatch", async () => {
    const client = new QueryClient();
    const user = userEvent.setup();

    render(<PasswordForm hasPassword={false} />, {
      wrapper: wrapper(client),
    });

    await user.type(screen.getByLabelText("New Password"), "sup3rsecret!");
    await user.type(
      screen.getByLabelText("Confirm New Password"),
      "different99",
    );
    await user.click(screen.getByRole("button", { name: /set password/i }));

    await waitFor(() => {
      expect(screen.getByText("Passwords do not match")).toBeInTheDocument();
    });
    expect(callAction).not.toHaveBeenCalled();
  });
});
