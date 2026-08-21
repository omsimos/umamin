import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const callAction = vi.fn();
vi.mock("@/lib/api", () => ({
  callAction: (name: string, input: unknown) => callAction(name, input),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { LoginForm } from "@/routes/_public/-auth/login-form";
import { RegisterForm } from "@/routes/_public/-auth/register-form";

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

afterEach(() => {
  callAction.mockReset();
});

describe("LoginForm", () => {
  it("announces the server error via role=alert", async () => {
    callAction.mockResolvedValue({ error: "Incorrect username or password" });
    renderWithClient(<LoginForm />);

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "umamin" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secretpass" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Login" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Incorrect username or password");
    expect(callAction).toHaveBeenCalledWith("login", {
      username: "umamin",
      password: "secretpass",
      // No VITE_TURNSTILE_SITE_KEY in the suite, so the widget never renders
      // and never mints a token — the field rides along empty and the server
      // skips verification for the same reason (no TURNSTILE_SECRET).
      turnstileToken: "",
    });
  });
});

describe("RegisterForm", () => {
  it("blocks submit and shows a field error when passwords mismatch", async () => {
    renderWithClient(<RegisterForm />);

    fireEvent.change(screen.getByLabelText(/Username/), {
      target: { value: "umamin" },
    });
    fireEvent.change(screen.getByLabelText(/^Password/), {
      target: { value: "longenoughpw" },
    });
    fireEvent.change(screen.getByLabelText(/Confirm Password/), {
      target: { value: "different" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create an account" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Password does not match");
    // Client-side validation must short-circuit before hitting the API.
    expect(callAction).not.toHaveBeenCalled();
  });

  it("submits a valid payload to the signup action", async () => {
    callAction.mockResolvedValue({ error: "Username already exists" });
    renderWithClient(<RegisterForm />);

    fireEvent.change(screen.getByLabelText(/Username/), {
      target: { value: "umamin" },
    });
    fireEvent.change(screen.getByLabelText(/^Password/), {
      target: { value: "longenoughpw" },
    });
    fireEvent.change(screen.getByLabelText(/Confirm Password/), {
      target: { value: "longenoughpw" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create an account" }));

    await waitFor(() =>
      expect(callAction).toHaveBeenCalledWith("signup", {
        username: "umamin",
        password: "longenoughpw",
        confirmPassword: "longenoughpw",
        turnstileToken: "",
      }),
    );
  });
});
