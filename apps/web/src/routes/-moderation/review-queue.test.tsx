import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReviewItem } from "@/lib/types";
import { ReviewQueue } from "./review-queue";

const { callAction } = vi.hoisted(() => ({ callAction: vi.fn() }));
vi.mock("@/lib/api", () => ({ callAction }));
vi.mock("@/lib/navigation", () => ({
  // oxlint-disable-next-line typescript/no-explicit-any -- test stub
  Link: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const item = (id: string, content: string): ReviewItem => ({
  kind: "post",
  id,
  content,
  author: null,
  postId: null,
  context: null,
  createdAt: new Date(),
  flaggedAt: new Date(),
  severe: 95,
  drama: 10,
  reason: "harassment",
  label: "severe",
  appealed: false,
  disputes: 0,
});

function renderQueue() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <ReviewQueue />
    </QueryClientProvider>,
  );
}

const row = (content: string) =>
  within(screen.getByText(content).closest("li") as HTMLElement);

describe("ReviewQueue", () => {
  beforeEach(() => {
    callAction.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              data: [item("a", "first post"), item("b", "second post")],
              nextCursor: null,
            }),
          ),
      ),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("keeps a row disabled while its decision is in flight, even after acting on another row", async () => {
    const pending: Array<(value: unknown) => void> = [];
    callAction.mockImplementation(
      () => new Promise((resolve) => pending.push(resolve)),
    );
    renderQueue();
    await screen.findByText("first post");

    fireEvent.click(row("first post").getByRole("button", { name: "Keep" }));
    await waitFor(() =>
      expect(
        row("first post").getByRole("button", { name: "Keep" }),
      ).toBeDisabled(),
    );

    fireEvent.click(row("second post").getByRole("button", { name: "Keep" }));
    await waitFor(() =>
      expect(
        row("second post").getByRole("button", { name: "Keep" }),
      ).toBeDisabled(),
    );
    expect(
      row("first post").getByRole("button", { name: "Keep" }),
    ).toBeDisabled();
    expect(
      row("first post").getByRole("button", { name: "Uncover" }),
    ).toBeDisabled();
    expect(callAction).toHaveBeenCalledWith("keepContentFlagAction", {
      kind: "post",
      id: "a",
      content: "first post",
    });

    await act(async () => {
      for (const resolve of pending) resolve({ success: true });
    });
    await waitFor(() =>
      expect(screen.queryByText("first post")).not.toBeInTheDocument(),
    );
  });

  it("disarms the second tap on Remove when another row is touched", async () => {
    callAction.mockImplementation(() => new Promise(() => {}));
    renderQueue();
    await screen.findByText("first post");

    fireEvent.click(row("first post").getByRole("button", { name: "Remove" }));
    expect(
      row("first post").getByRole("button", { name: "Tap again to remove" }),
    ).toBeInTheDocument();

    fireEvent.click(row("second post").getByRole("button", { name: "Keep" }));
    expect(
      row("first post").getByRole("button", { name: "Remove" }),
    ).toBeInTheDocument();
  });

  it("disarms the second tap on Remove after a few seconds", async () => {
    renderQueue();
    await screen.findByText("first post");
    vi.useFakeTimers();

    fireEvent.click(row("first post").getByRole("button", { name: "Remove" }));
    expect(
      row("first post").getByRole("button", { name: "Tap again to remove" }),
    ).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(
      row("first post").getByRole("button", { name: "Remove" }),
    ).toBeInTheDocument();
    expect(callAction).not.toHaveBeenCalled();
  });
});
