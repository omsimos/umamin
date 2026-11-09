import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicUser } from "@/lib/types";

const sendMessageAction = vi.fn();
vi.mock("@/routes/_social/-lib/actions", () => ({
  sendMessageAction: (input: unknown) => sendMessageAction(input),
}));

const captureException = vi.fn();
vi.mock("@/lib/posthog", () => ({
  captureException: (error: unknown, properties?: unknown) =>
    captureException(error, properties),
}));

const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: (m: string) => toastError(m) },
}));

vi.mock("@/lib/navigation", () => ({
  // oxlint-disable-next-line typescript/no-explicit-any -- test stub
  Link: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { ChatForm } = await import("@/routes/_social/-components/chat-form");

const recipient = {
  id: "receiver",
  username: "alice",
  question: "Ask me anything",
  quietMode: false,
  imageUrl: null,
} as PublicUser;

function renderForm() {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <ChatForm user={recipient} />
    </QueryClientProvider>,
  );
  return queryClient;
}

async function typeMessage() {
  await userEvent.type(
    screen.getByRole("textbox", { name: "Anonymous message" }),
    "hello",
  );
}

const signedIn = () => Response.json({ user: { id: "sender" } });

beforeEach(() => {
  vi.clearAllMocks();
  sendMessageAction.mockResolvedValue({ success: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ChatForm session check", () => {
  // One dropped /api/me on mobile data used to block the send outright.
  it("retries a dropped session check and sends", async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValue(signedIn());
    vi.stubGlobal("fetch", fetch);
    renderForm();

    await typeMessage();
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(sendMessageAction).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(toastError).not.toHaveBeenCalled();
  });

  it("checks once however often the form is submitted meanwhile", async () => {
    let resolve: (res: Response) => void = () => {};
    const fetch = vi.fn(() => new Promise<Response>((r) => (resolve = r)));
    vi.stubGlobal("fetch", fetch);
    renderForm();

    await typeMessage();
    const form = screen
      .getByRole("textbox", { name: "Anonymous message" })
      .closest("form") as HTMLFormElement;
    fireEvent.submit(form);
    fireEvent.submit(form);
    fireEvent.submit(form);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Send" })).toBeDisabled(),
    );
    expect(fetch).toHaveBeenCalledTimes(1);

    resolve(signedIn());
    await waitFor(() => expect(sendMessageAction).toHaveBeenCalledTimes(1));
  });

  it("reuses a viewer the app already resolved", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const queryClient = renderForm();
    queryClient.setQueryData(["current_user"], { user: { id: "sender" } });

    await typeMessage();
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(sendMessageAction).toHaveBeenCalledTimes(1));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("asks a signed-out sender to confirm before sending", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
    );
    renderForm();

    await typeMessage();
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("You are not logged in")).toBeVisible();
    expect(sendMessageAction).not.toHaveBeenCalled();
  });

  it("explains a connection failure without reporting it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );
    renderForm();

    await typeMessage();
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(
      () =>
        expect(toastError).toHaveBeenCalledWith(
          "Couldn't reach Umamin. Check your connection and try again.",
        ),
      { timeout: 3_000 },
    );
    expect(captureException).not.toHaveBeenCalled();
    expect(sendMessageAction).not.toHaveBeenCalled();
  });
});
