import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/query";
import type { MessageThreadResponse } from "@/lib/types";
import { MessageThreadView } from "./thread-view";

const { markThreadReadAction } = vi.hoisted(() => ({
  markThreadReadAction: vi.fn(),
}));
vi.mock("./actions", () => ({
  markThreadReadAction,
  createReplyAction: vi.fn(),
}));
vi.mock("@/lib/query-fetchers", () => ({ fetchMessageThread: vi.fn() }));
vi.mock("@/lib/navigation", () => ({
  // oxlint-disable-next-line typescript/no-explicit-any -- test stub
  Link: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const readAt = new Date(Date.now() - 60 * 60_000);

function thread(lastReplyAt: Date): MessageThreadResponse {
  return {
    message: {
      id: "m1",
      question: "q",
      content: "opening",
      reply: "first reply",
      createdAt: readAt,
      updatedAt: null,
      openedAt: readAt,
      receiverReadAt: readAt,
      lastReplyAt,
      receiver: { username: "someone" },
    },
    replies: [],
    viewerRole: "receiver",
    threadable: true,
  } as unknown as MessageThreadResponse;
}

describe("MessageThreadView", () => {
  beforeEach(() => {
    markThreadReadAction.mockReset();
    markThreadReadAction.mockResolvedValue({ success: true });
  });

  it("marks a reply read when it arrives while the thread is open", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const key = queryKeys.messageThread("m1");
    client.setQueryData(key, thread(new Date(Date.now() - 30 * 60_000)));

    render(
      <QueryClientProvider client={client}>
        <MessageThreadView messageId="m1" />
      </QueryClientProvider>,
    );
    await screen.findByText("opening");
    await waitFor(() => expect(markThreadReadAction).toHaveBeenCalledTimes(1));

    act(() => {
      client.setQueryData(key, thread(new Date()));
    });

    await waitFor(() => expect(markThreadReadAction).toHaveBeenCalledTimes(2));

    act(() => {
      client.setQueryData(key, thread(new Date(Date.now() - 10 * 60_000)));
    });
    expect(markThreadReadAction).toHaveBeenCalledTimes(2);
  });
});
