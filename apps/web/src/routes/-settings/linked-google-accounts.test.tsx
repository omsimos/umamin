import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const unlinkGoogleAccountAction = vi.fn();
vi.mock("./actions", () => ({
  unlinkGoogleAccountAction: (input: unknown) =>
    unlinkGoogleAccountAction(input),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (m: string) => toastSuccess(m),
    error: (m: string) => toastError(m),
  },
}));

import { queryKeys } from "@/lib/query";
import type { LinkedAccount } from "@/lib/types";
import { LinkedGoogleAccounts } from "./linked-google-accounts";

function linked(
  email: string,
  createdAt: string,
  linkId: string,
): LinkedAccount {
  return {
    providerId: "google",
    email,
    picture: "",
    // The browser gets createdAt as an ISO string from JSON.
    createdAt: createdAt as unknown as Date,
    linkId,
  };
}

// Linked in the same second, so only linkId tells them apart.
const SAME_SECOND = "2026-01-01T00:00:00.000Z";
const FIRST = linked("first@example.com", SAME_SECOND, "a".repeat(32));
const SECOND = linked("second@example.com", SAME_SECOND, "b".repeat(32));

function renderAccounts(accounts: LinkedAccount[]) {
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const user = {
    id: "u1",
    hasPassword: true,
    account: accounts[0] ?? null,
    accounts,
  } as never;
  render(
    <QueryClientProvider client={client}>
      <LinkedGoogleAccounts user={user} />
    </QueryClientProvider>,
  );
  return { invalidate };
}

describe("LinkedGoogleAccounts", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("offers Connect with a link intent when nothing is linked", () => {
    renderAccounts([]);

    expect(
      screen.getByRole("link", { name: /connect with google/i }),
    ).toHaveAttribute("href", "/auth/google?intent=link");
  });

  it("lists every linked Google account", () => {
    renderAccounts([FIRST, SECOND]);

    expect(screen.getByText(FIRST.email)).toBeInTheDocument();
    expect(screen.getByText(SECOND.email)).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /connect with google/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/more than one google account/i),
    ).toBeInTheDocument();
  });

  it("shows no multiple-account warning for a single account", () => {
    renderAccounts([FIRST]);

    expect(
      screen.queryByText(/more than one google account/i),
    ).not.toBeInTheDocument();
  });

  it("disconnects the chosen account after confirming", async () => {
    unlinkGoogleAccountAction.mockResolvedValue({ success: true });
    const { invalidate } = renderAccounts([FIRST, SECOND]);

    await userEvent.click(
      screen.getByRole("button", { name: `Disconnect ${SECOND.email}` }),
    );
    await userEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Disconnect",
      }),
    );

    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: queryKeys.currentUser(),
      }),
    );
    expect(unlinkGoogleAccountAction).toHaveBeenCalledTimes(1);
    expect(unlinkGoogleAccountAction).toHaveBeenCalledWith({
      linkId: SECOND.linkId,
    });
  });

  it("does nothing until the dialog is confirmed", async () => {
    renderAccounts([FIRST]);

    await userEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    await userEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Cancel",
      }),
    );

    expect(unlinkGoogleAccountAction).not.toHaveBeenCalled();
  });

  it("shows the server's reason when the account can't be removed", async () => {
    unlinkGoogleAccountAction.mockResolvedValue({
      error: "Set a password first.",
    });
    renderAccounts([FIRST]);

    await userEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    await userEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Disconnect",
      }),
    );

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Set a password first."),
    );
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
