import { isRedirect } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";
import { RequestFailedError } from "@/lib/request-error";
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
    // oxlint-disable-next-line typescript/no-explicit-any -- minimal partial context for the guard
    context: { queryClient: { ensureQueryData } } as any,
    // oxlint-disable-next-line typescript/no-explicit-any -- unused router args
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

  // Public pages read a failed /api/me as signed out. Here that would send a
  // signed-in user to /login, so the error has to surface instead.
  it("surfaces a 5xx from /api/me instead of redirecting to /login", async () => {
    const failure = new RequestFailedError("/api/me", 502);
    const beforeLoad = Route.options.beforeLoad as BeforeLoad;
    const run = beforeLoad({
      context: {
        queryClient: { ensureQueryData: vi.fn().mockRejectedValue(failure) },
        // oxlint-disable-next-line typescript/no-explicit-any -- minimal partial context for the guard
      } as any,
      // oxlint-disable-next-line typescript/no-explicit-any -- unused router args
    } as any);

    await expect(run).rejects.toBe(failure);
  });

  it("passes through and returns the current user when authenticated", async () => {
    const result = await runBeforeLoad({ user: { id: "u1", username: "a" } });
    expect(result).toEqual({
      currentUser: { user: { id: "u1", username: "a" } },
    });
  });
});
