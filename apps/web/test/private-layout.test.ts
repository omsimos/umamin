import { isRedirect } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";
import { Route } from "@/routes/_private";

// The pathless _private layout gates every private route: its beforeLoad
// ensures the current-user query and redirects to /login when there is no user.
// ensureQueryData is mocked so the guard's decision is exercised in isolation
// (the SSR fetch path is covered separately by the loader-fetch helper).

type BeforeLoad = NonNullable<typeof Route.options.beforeLoad>;

function runBeforeLoad(user: unknown) {
  const ensureQueryData = vi.fn().mockResolvedValue(user);
  const beforeLoad = Route.options.beforeLoad as BeforeLoad;
  // Only context.queryClient.ensureQueryData is touched by the guard.
  return beforeLoad({
    // biome-ignore lint/suspicious/noExplicitAny: minimal partial context for the guard
    context: { queryClient: { ensureQueryData } } as any,
    // biome-ignore lint/suspicious/noExplicitAny: unused router args
  } as any);
}

describe("_private layout guard", () => {
  it("redirects to /login when unauthenticated", async () => {
    try {
      await runBeforeLoad({});
      throw new Error("expected beforeLoad to throw a redirect");
    } catch (err) {
      expect(isRedirect(err)).toBe(true);
      const to =
        (err as { to?: string; options?: { to?: string } }).to ??
        (err as { options?: { to?: string } }).options?.to;
      expect(to).toBe("/login");
    }
  });

  it("passes through and returns the current user when authenticated", async () => {
    const result = await runBeforeLoad({ user: { id: "u1", username: "a" } });
    expect(result).toEqual({
      currentUser: { user: { id: "u1", username: "a" } },
    });
  });
});
