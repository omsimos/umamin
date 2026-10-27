import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DmThreadItem } from "@/lib/dm/types";
import { fetchDmThreadsPage } from "@/lib/query-fetchers";
import { ChatsList } from "./chats-list";

vi.mock("@/lib/navigation", () => ({
  // biome-ignore lint/suspicious/noExplicitAny: test stub
  Link: ({ to, href, children, ...rest }: any) => (
    <a href={to ?? href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/query-fetchers", () => ({
  fetchDmThreadsPage: vi.fn(),
}));

function thread(over: Partial<DmThreadItem>): DmThreadItem {
  return {
    threadId: "a:b",
    peer: { id: "b", username: "bob", displayName: null, imageUrl: null },
    preview: "hi",
    lastFromMe: false,
    lastMessageAt: Date.now() - 60_000,
    unread: false,
    ...over,
  };
}

function renderList() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ChatsList />
    </QueryClientProvider>,
  );
}

describe("ChatsList", () => {
  it("labels own, unsent and unread threads and links each to its chat", async () => {
    vi.mocked(fetchDmThreadsPage).mockResolvedValue({
      data: [
        thread({
          threadId: "a:b",
          preview: "see you",
          lastFromMe: true,
        }),
        thread({
          threadId: "a:c",
          peer: {
            id: "c",
            username: "cara",
            displayName: "Cara",
            imageUrl: null,
          },
          preview: null,
          unread: true,
        }),
      ],
      nextCursor: null,
    });

    renderList();

    const own = await screen.findByRole("link", { name: /bob/ });
    expect(own).toHaveAttribute("href", "/inbox/chats/bob");
    expect(within(own).getByText("You: see you")).toBeInTheDocument();
    expect(within(own).queryByRole("img", { name: "Unread" })).toBeNull();

    const unsent = screen.getByRole("link", { name: /Cara/ });
    expect(unsent).toHaveAttribute("href", "/inbox/chats/cara");
    expect(within(unsent).getByText("Message unsent")).toBeInTheDocument();
    expect(
      within(unsent).getByRole("img", { name: "Unread" }),
    ).toBeInTheDocument();
  });

  it("explains how to start a chat when there are none", async () => {
    vi.mocked(fetchDmThreadsPage).mockResolvedValue({
      data: [],
      nextCursor: null,
    });

    renderList();

    expect(await screen.findByText("No chats yet")).toBeInTheDocument();
  });
});
