import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/query";

vi.mock("@/lib/navigation", () => ({
  // biome-ignore lint/suspicious/noExplicitAny: test stub
  Link: ({ to, href, children, prefetch: _p, preload: _pl, ...rest }: any) => (
    <a href={to ?? href} {...rest}>
      {children}
    </a>
  ),
  usePathname: () => "/notes",
}));

const flags = vi.hoisted(() => ({ chat: false, dm: false }));
vi.mock("@/hooks/use-feature-flags", () => ({ useFeatureFlags: () => flags }));

vi.mock("@/lib/query-fetchers", () => ({
  fetchCurrentUserOptional: () => new Promise(() => {}),
  fetchDmUnread: () => new Promise(() => {}),
}));

vi.mock("./nav-notifications", () => ({
  NavNotifications: () => <a href="/notifications">Notifications</a>,
}));

import { PublicMenubar } from "./public-menu-bar";

function renderBar(chat: boolean, dm = false, unread = 0) {
  flags.chat = chat;
  flags.dm = dm;
  const client = new QueryClient();
  client.setQueryData(queryKeys.currentUser(), {
    user: { id: "u1", username: "ana" },
  });
  client.setQueryData(queryKeys.dmUnread(), { count: unread });
  render(
    <QueryClientProvider client={client}>
      <PublicMenubar />
    </QueryClientProvider>,
  );
  return screen.getAllByRole("link").map((a) => a.getAttribute("href"));
}

describe("PublicMenubar", () => {
  it("keeps five slots with Profile in the middle once Chat is launched", () => {
    const hrefs = renderBar(true);
    expect(hrefs).toEqual([
      "/chat",
      "/notes",
      "/user/ana",
      "/feed",
      "/notifications",
    ]);
  });

  it("shows Groups in the first slot until Chat is launched", () => {
    const hrefs = renderBar(false);
    expect(hrefs).toHaveLength(5);
    expect(hrefs[0]).toBe("/groups");
    expect(hrefs[2]).toBe("/user/ana");
  });

  it("marks Profile when there are unread chats and DMs are on", () => {
    renderBar(true, true, 2);
    expect(
      screen.getByRole("link", { name: "Your profile (unread chats)" }),
    ).toHaveAttribute("href", "/user/ana");
  });

  it("ignores a cached unread count once DMs are off", () => {
    renderBar(true, false, 2);
    expect(
      screen.getByRole("link", { name: "Your profile" }),
    ).toBeInTheDocument();
  });
});
