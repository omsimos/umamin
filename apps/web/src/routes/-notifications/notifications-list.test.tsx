import type { InfiniteData } from "@tanstack/react-query";
import {
  focusManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/query";
import type { NotificationItem, NotificationsResponse } from "@/lib/types";
import { NotificationsList } from "./notifications-list";

const { callAction, fetchNotificationsPage } = vi.hoisted(() => ({
  callAction: vi.fn(),
  fetchNotificationsPage: vi.fn(),
}));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  callAction,
}));
vi.mock("@/lib/query-fetchers", () => ({ fetchNotificationsPage }));
vi.mock("@/lib/navigation", () => ({
  // oxlint-disable-next-line typescript/no-explicit-any -- test stub
  Link: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const notification = (
  id: string,
  username: string,
  updatedAt: Date,
): NotificationItem => ({
  id,
  type: "follow",
  targetId: id,
  count: 1,
  preview: null,
  updatedAt,
  actor: { id: `u-${id}`, username, displayName: null, imageUrl: null },
});

const oldAt = new Date(Date.now() - 10 * 60_000);
const newAt = new Date(Date.now() - 5_000);
const oldItem = notification("old", "olduser", oldAt);
const newItem = notification("new", "newuser", newAt);

function renderList(updatedAt: number, lastSeen = oldAt.getTime()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData<InfiniteData<NotificationsResponse>>(
    queryKeys.notifications(),
    {
      pages: [{ notifications: [oldItem], nextCursor: null, lastSeen }],
      pageParams: [null],
    },
    { updatedAt },
  );
  render(
    <QueryClientProvider client={client}>
      <NotificationsList />
    </QueryClientProvider>,
  );
  return client;
}

const seenThroughCalls = () =>
  callAction.mock.calls
    .filter(([name]) => name === "markNotificationsSeenAction")
    .map(([, input]) => (input as { seenThrough: number }).seenThrough);

describe("NotificationsList", () => {
  beforeEach(() => {
    callAction.mockReset();
    fetchNotificationsPage.mockReset();
  });

  afterEach(() => {
    focusManager.setFocused(undefined);
  });

  it("refreshes a stale cached list on a revisit and marks the newest item seen", async () => {
    callAction.mockResolvedValue({ success: true });
    fetchNotificationsPage.mockResolvedValue({
      notifications: [newItem, oldItem],
      nextCursor: null,
      lastSeen: oldAt.getTime(),
    });

    renderList(Date.now() - 60_000);

    expect(await screen.findByText(/newuser followed you/)).toBeInTheDocument();
    await waitFor(() => expect(seenThroughCalls()).toContain(newAt.getTime()));
    expect(fetchNotificationsPage).toHaveBeenCalledTimes(1);
    expect(seenThroughCalls()).not.toContain(oldAt.getTime());
  });

  it("doesn't refetch a list that is still fresh", async () => {
    callAction.mockResolvedValue({ success: true });

    renderList(Date.now());
    act(() => focusManager.setFocused(true));

    await waitFor(() => expect(seenThroughCalls()).toHaveLength(1));
    expect(fetchNotificationsPage).not.toHaveBeenCalled();
  });
});
