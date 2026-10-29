import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const logoutAction = vi.fn();
vi.mock("./actions", () => ({ logoutAction: () => logoutAction() }));

const navigate = vi.fn();
vi.mock("@/lib/navigation", () => ({ useAppNavigate: () => navigate }));

const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (m: string) => toastError(m) },
}));

import { SignOutButton } from "./sign-out-button";

function renderButton(client = new QueryClient()) {
  render(
    <QueryClientProvider client={client}>
      <SignOutButton />
    </QueryClientProvider>,
  );
  return client;
}

describe("SignOutButton", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("a failed sign-out stays on the page, keeps the cache and toasts", async () => {
    // callAction never rejects; a CSRF block or a 500 comes back as { error }.
    logoutAction.mockResolvedValue({ error: "An error occurred" });
    const client = renderButton();
    client.setQueryData(["me"], { id: "u1" });

    await userEvent.click(screen.getByRole("button", { name: /sign out/i }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "Couldn't sign out. Please try again.",
      ),
    );
    expect(navigate).not.toHaveBeenCalled();
    expect(client.getQueryData(["me"])).toEqual({ id: "u1" });
  });

  it("a successful sign-out clears the cache and follows the redirect", async () => {
    logoutAction.mockResolvedValue({ redirect: "/login" });
    const client = renderButton();
    client.setQueryData(["me"], { id: "u1" });

    await userEvent.click(screen.getByRole("button", { name: /sign out/i }));

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith("/login", { replace: true }),
    );
    expect(client.getQueryData(["me"])).toBeUndefined();
    expect(toastError).not.toHaveBeenCalled();
  });
});
