import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router";
import { render } from "@testing-library/react";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";
import { Route as FeedRoute } from "@/routes/_social/feed";
import { Route as LeaderboardRoute } from "@/routes/_social/leaderboard";
import { Route as NotesRoute } from "@/routes/_social/notes";
import { Route as PostRoute } from "@/routes/_social/post.$id";
import { Route as SendMessageRoute } from "@/routes/_social/to.$username";
import { Route as UserRoute } from "@/routes/_social/user.$username";
import { Route as GroupRoute } from "@/routes/groups.$tag.index";

// During a view-transition navigation the old route component can render once
// more after the router has removed its match. Reading loader data through the
// throwing hooks then crashes the page (React #520 in production).
const routes = {
  feed: FeedRoute,
  leaderboard: LeaderboardRoute,
  notes: NotesRoute,
  post: PostRoute,
  "send message": SendMessageRoute,
  user: UserRoute,
  group: GroupRoute,
};

describe("route components without an active match", () => {
  // A router whose tree has none of these routes, so every match store is empty.
  const router = createRouter({
    routeTree: createRootRoute(),
    history: createMemoryHistory(),
  });

  it.each(Object.entries(routes))(
    "%s renders nothing instead of throwing",
    (_, route) => {
      const Component = route.options.component as ComponentType;

      const { container } = render(
        <RouterContextProvider router={router}>
          <Component />
        </RouterContextProvider>,
      );

      expect(container).toBeEmptyDOMElement();
    },
  );
});
