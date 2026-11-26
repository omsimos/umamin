import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Route as PostRoute } from "../post.$id";
import { Route as UserRoute } from "../user.$username";

// The router keys a route's component by its remountDeps only. Without them,
// /post/A -> /post/B reuses one instance and a draft typed on A is sent on B.
function Draft() {
  const [value, setValue] = useState("");
  return (
    <input
      aria-label="Draft"
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  );
}

const cases = [
  {
    name: "post",
    path: "/post/$id",
    remountDeps: PostRoute.options.remountDeps,
    from: "/post/a",
    to: "/post/b",
  },
  {
    name: "profile",
    path: "/user/$username",
    remountDeps: UserRoute.options.remountDeps,
    from: "/user/alice",
    to: "/user/bob",
  },
];

describe("social detail routes", () => {
  it.each(cases)(
    "$name page starts fresh when only the param changes",
    async ({ path, remountDeps, from, to }) => {
      const rootRoute = createRootRoute();
      const route = createRoute({
        getParentRoute: () => rootRoute,
        path,
        // oxlint-disable-next-line typescript/no-explicit-any -- the real route's typed fn, reused on a stand-in route
        remountDeps: remountDeps as any,
        component: Draft,
      });
      const router = createRouter({
        routeTree: rootRoute.addChildren([route]),
        history: createMemoryHistory({ initialEntries: [from] }),
      });

      render(<RouterProvider router={router} />);
      await userEvent.type(await screen.findByLabelText("Draft"), "hello");

      await act(() => router.navigate({ to }));

      expect(router.state.location.pathname).toBe(to);
      expect(screen.getByLabelText("Draft")).toHaveValue("");
    },
  );
});
