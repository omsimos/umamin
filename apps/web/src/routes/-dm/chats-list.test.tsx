import {
  focusManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { act, render, screen, within } from "@testing-library/react";
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

vi.mock("@/hooks/use-chat-link", () => ({
  useChatLink: () => ({ href: "/chat", external: false }),
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
    unread: 0,
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
          unread: 128,
        }),
      ],
      nextCursor: null,
    });

    renderList();

    const own = await screen.findByRole("link", { name: /bob/ });
    expect(own).toHaveAttribute("href", "/inbox/chats/bob");
    expect(within(own).getByText("You: see you")).toBeInTheDocument();
    expect(within(own).queryByText(/unread/)).toBeNull();

    const unsent = screen.getByRole("link", { name: /Cara/ });
    expect(unsent).toHaveAttribute("href", "/inbox/chats/cara");
    expect(within(unsent).getByText("Message unsent")).toBeInTheDocument();
    // Past two digits the badge is "lots"; the link still says the number.
    expect(within(unsent).getByText("99+")).toBeInTheDocument();
    expect(unsent).toHaveAccessibleName(/128 unread/);
  });

  it("explains how to start a chat when there are none", async () => {
    vi.mocked(fetchDmThreadsPage).mockResolvedValue({
      data: [],
      nextCursor: null,
    });

    renderList();

    expect(await screen.findByText("No chats yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Try it/ })).toHaveAttribute(
      "href",
      "/chat",
    );
  });

  it("offers Umamin Chat only after the last page", async () => {
    vi.mocked(fetchDmThreadsPage).mockResolvedValue({
      data: [thread({})],
      nextCursor: "more",
    });

    const { unmount } = renderList();
    await screen.findByRole("link", { name: /bob/ });
    expect(screen.queryByRole("link", { name: /Try it/ })).toBeNull();
    unmount();

    vi.mocked(fetchDmThreadsPage).mockResolvedValue({
      data: [thread({})],
      nextCursor: null,
    });
    renderList();
    expect(await screen.findByRole("link", { name: /Try it/ })).toHaveAttribute(
      "href",
      "/chat",
    );
  });

  it("refetches when the app regains focus", async () => {
    vi.mocked(fetchDmThreadsPage).mockResolvedValue({
      data: [thread({ preview: "old news" })],
      nextCursor: null,
    });
    renderList();
    await screen.findByText("old news");

    vi.mocked(fetchDmThreadsPage).mockResolvedValue({
      data: [thread({ preview: "fresh", unread: 1 })],
      nextCursor: null,
    });
    // Past the stale window, as after the app sat in the background.
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now + 60_000);
    try {
      act(() => {
        focusManager.setFocused(false);
        focusManager.setFocused(true);
      });
      expect(await screen.findByText("fresh")).toBeInTheDocument();
    } finally {
      clock.mockRestore();
      focusManager.setFocused(undefined);
    }
  });
});
