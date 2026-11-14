import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LinkTabs } from "@/components/link-tabs";

// Tabs that share a path and differ only by search. TanStack sets
// aria-current itself on links it considers active, so a loose search match
// would mark the empty-search tab current on every URL of that path.
function renderAt(url: string) {
  const rootRoute = createRootRoute();
  const boardRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/leaderboard",
    validateSearch: (search: Record<string, unknown>) => ({
      tab: search.tab === "streak" ? ("streak" as const) : undefined,
    }),
    component: function Board() {
      const { tab } = boardRoute.useSearch();
      return (
        <LinkTabs
          tabs={[
            {
              label: "Aura",
              href: "/leaderboard",
              search: {},
              active: tab !== "streak",
            },
            {
              label: "Best streak",
              href: "/leaderboard",
              search: { tab: "streak" },
              active: tab === "streak",
            },
          ]}
        />
      );
    },
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([boardRoute]),
    history: createMemoryHistory({ initialEntries: [url] }),
  });
  render(<RouterProvider router={router} />);
}

async function currentTabs() {
  const links = await screen.findAllByRole("link");
  return links
    .filter((link) => link.getAttribute("aria-current") === "page")
    .map((link) => link.textContent);
}

describe("LinkTabs with shared paths", () => {
  it("marks only the streak tab current on ?tab=streak", async () => {
    renderAt("/leaderboard?tab=streak");
    expect(await currentTabs()).toEqual(["Best streak"]);
  });

  it("marks only the aura tab current on the bare path", async () => {
    renderAt("/leaderboard");
    expect(await currentTabs()).toEqual(["Aura"]);
  });
});
