import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { queryKeys } from "@/lib/query";
import type { FeatureFlagsResponse } from "@/lib/types";
import { useChatLink } from "./use-chat-link";

function withFlags(flags: FeatureFlagsResponse | null) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  if (flags) client.setQueryData(queryKeys.featureFlags(), flags);
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const OFF = { pro: false, contentModeration: false, chat: false, dm: false };

// Launching chat must be a flag flip: every entry point follows this hook.
describe("useChatLink", () => {
  it("links to the standalone app while the flag is off", () => {
    const { result } = renderHook(() => useChatLink("footer"), {
      wrapper: withFlags(OFF),
    });
    expect(result.current.external).toBe(true);
    expect(result.current.href).toContain("utm_content=footer");
  });

  it("links in-app once the flag is on", () => {
    const { result } = renderHook(() => useChatLink("footer"), {
      wrapper: withFlags({ ...OFF, chat: true }),
    });
    expect(result.current).toEqual({ href: "/chat", external: false });
  });

  it("stays external until the flags have loaded", () => {
    const { result } = renderHook(() => useChatLink("nav"), {
      wrapper: withFlags(null),
    });
    expect(result.current.external).toBe(true);
  });
});
