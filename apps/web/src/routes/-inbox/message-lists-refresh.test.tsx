import type { InfiniteData, QueryKey } from "@tanstack/react-query";
import {
  focusManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/query";
import type { MessagesResponse, MessageWithReceiver } from "@/lib/types";
import { ReceivedMessages } from "./received-messages";
import { SentMessages } from "./sent-messages";

const { fetchMessagesPage } = vi.hoisted(() => ({
  fetchMessagesPage: vi.fn(),
}));
vi.mock("@/lib/query-fetchers", () => ({ fetchMessagesPage }));
vi.mock("./received-card", () => ({
  ReceivedMessageCard: ({ data }: { data: MessageWithReceiver }) => (
    <p>{data.question}</p>
  ),
}));
vi.mock("./sent-card", () => ({
  SentMessageCard: ({ data }: { data: MessageWithReceiver }) => (
    <p>{data.question}</p>
  ),
}));

const message = (id: string) =>
  ({ id, question: `question ${id}` }) as MessageWithReceiver;

function renderList(
  ui: ReactElement,
  queryKey: QueryKey,
  pages: MessagesResponse[],
  updatedAt: number,
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData<InfiniteData<MessagesResponse>>(
    queryKey,
    { pages, pageParams: pages.map((_, i) => (i === 0 ? null : `c${i}`)) },
    { updatedAt },
  );
  render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  return client;
}

const refocus = () =>
  act(() => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
  });

describe.each([
  {
    name: "ReceivedMessages",
    ui: <ReceivedMessages />,
    queryKey: queryKeys.receivedMessages(),
    type: "received",
  },
  {
    name: "SentMessages",
    ui: <SentMessages />,
    queryKey: queryKeys.sentMessages(),
    type: "sent",
  },
])("$name refresh", ({ ui, queryKey, type }) => {
  beforeEach(() => {
    fetchMessagesPage.mockReset();
    fetchMessagesPage.mockResolvedValue({
      messages: [message("new"), message("old")],
      nextCursor: null,
    });
  });

  afterEach(() => {
    focusManager.setFocused(undefined);
    vi.useRealTimers();
  });

  it("refreshes page 1 when the app regains focus after the list went stale", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    renderList(
      ui,
      queryKey,
      [{ messages: [message("old")], nextCursor: null }],
      Date.now(),
    );
    refocus();
    expect(fetchMessagesPage).not.toHaveBeenCalled();

    vi.setSystemTime(Date.now() + 60_000);
    refocus();

    expect(await screen.findByText("question new")).toBeInTheDocument();
    expect(fetchMessagesPage).toHaveBeenCalledTimes(1);

    refocus();
    expect(fetchMessagesPage).toHaveBeenCalledTimes(1);
  });

  it("keeps a stale multi-page list in place on a revisit", async () => {
    const client = renderList(
      ui,
      queryKey,
      [
        { messages: [message("old")], nextCursor: "c1" },
        { messages: [message("older")], nextCursor: null },
      ],
      Date.now() - 60_000,
    );

    expect(await screen.findByText("question older")).toBeInTheDocument();
    expect(fetchMessagesPage).not.toHaveBeenCalled();
    expect(
      client.getQueryData<InfiniteData<MessagesResponse>>(queryKey)?.pages,
    ).toHaveLength(2);
  });

  it("refetches only page 1 of a stale multi-page list on focus", async () => {
    const client = renderList(
      ui,
      queryKey,
      [
        { messages: [message("old")], nextCursor: "c1" },
        { messages: [message("older")], nextCursor: null },
      ],
      Date.now() - 60_000,
    );
    refocus();

    expect(await screen.findByText("question new")).toBeInTheDocument();
    expect(fetchMessagesPage).toHaveBeenCalledTimes(1);
    expect(fetchMessagesPage).toHaveBeenCalledWith(type, null);
    expect(
      client.getQueryData<InfiniteData<MessagesResponse>>(queryKey)?.pages,
    ).toHaveLength(1);
  });
});
