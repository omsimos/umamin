import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const fetchCurrentUserOptional = vi.fn();
const fetchNotificationBadge = vi.fn();

vi.mock("@/lib/query-fetchers", () => ({
  fetchCurrentUserOptional: () => fetchCurrentUserOptional(),
  fetchNotificationBadge: () => fetchNotificationBadge(),
}));

import { NotificationBell } from "./notification-bell";

function renderBell() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <NotificationBell />
    </QueryClientProvider>,
  );
}

describe("NotificationBell", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when logged out and never hits the badge endpoint", async () => {
    fetchCurrentUserOptional.mockResolvedValue({});

    const { container } = renderBell();

    await waitFor(() => expect(fetchCurrentUserOptional).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
    expect(fetchNotificationBadge).not.toHaveBeenCalled();
  });

  it("links to /notifications without a count when all caught up", async () => {
    fetchCurrentUserOptional.mockResolvedValue({ user: { username: "alice" } });
    fetchNotificationBadge.mockResolvedValue({ unseen: 0 });

    renderBell();

    const link = await screen.findByRole("link", { name: "Notifications" });
    expect(link).toHaveAttribute("href", "/notifications");
  });

  it("shows the unseen count", async () => {
    fetchCurrentUserOptional.mockResolvedValue({ user: { username: "alice" } });
    fetchNotificationBadge.mockResolvedValue({ unseen: 3 });

    renderBell();

    const link = await screen.findByRole("link", {
      name: "Notifications (3 unread)",
    });
    expect(link).toHaveTextContent("3");
  });

  it("caps the count at 9+", async () => {
    fetchCurrentUserOptional.mockResolvedValue({ user: { username: "alice" } });
    fetchNotificationBadge.mockResolvedValue({ unseen: 10 });

    renderBell();

    const link = await screen.findByRole("link", {
      name: "Notifications (9+ unread)",
    });
    expect(link).toHaveTextContent("9+");
  });
});
