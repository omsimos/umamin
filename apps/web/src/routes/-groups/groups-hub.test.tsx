import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/query";
import type { UserGroupsResponse } from "@/lib/types";
import { GroupsHub } from "./groups-hub";

const { fetchUserGroups } = vi.hoisted(() => ({ fetchUserGroups: vi.fn() }));
vi.mock("@/lib/query-fetchers", () => ({
  fetchUserGroups,
  fetchCurrentUserOptional: vi.fn(async () => ({ user: null })),
}));
vi.mock("@/components/create-group-dialog", () => ({
  CreateGroupDialog: () => null,
}));
vi.mock("./actions", () => ({ respondToInviteAction: vi.fn() }));
vi.mock("@/lib/navigation", () => ({
  // oxlint-disable-next-line typescript/no-explicit-any -- test stub
  Link: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const invite = {
  group: {
    id: "g1",
    name: "Night owls",
    tag: "OWLS",
    icon: "moon",
    accent: null,
    memberCount: 3,
  },
  invitedAt: new Date(),
};

describe("GroupsHub", () => {
  beforeEach(() => {
    fetchUserGroups.mockReset();
  });

  it("refreshes a stale cached hub on a revisit so new invites show", async () => {
    fetchUserGroups.mockResolvedValue({ data: [], invites: [invite] });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    client.setQueryData<UserGroupsResponse>(
      queryKeys.userGroups(),
      { data: [], invites: [] },
      { updatedAt: Date.now() - 60_000 },
    );

    render(
      <QueryClientProvider client={client}>
        <GroupsHub />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Night owls")).toBeInTheDocument();
    expect(fetchUserGroups).toHaveBeenCalledTimes(1);
  });
});
