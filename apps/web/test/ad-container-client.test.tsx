import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ClientOnlyAdContainer } from "../src/components/ad-container-client";
import { queryKeys } from "../src/lib/query";
import type { CurrentUserResponse } from "../src/lib/types";

// The ad-free Pro gate. In vitest import.meta.env.DEV is true, so a rendered
// slot shows AdContainer's dev placeholder text ("ad: <placement>") — which is
// exactly the observable this asserts on. The viewer is seeded into the query
// cache (staleTime Infinity), so no /api/me fetch runs.

const DAY = 24 * 60 * 60 * 1000;

function renderWithViewer(viewer: CurrentUserResponse) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData<CurrentUserResponse>(queryKeys.currentUser(), viewer);
  return render(
    <QueryClientProvider client={client}>
      <ClientOnlyAdContainer placement="feed_top" />
    </QueryClientProvider>,
  );
}

const proViewer = (proUntil: Date) =>
  ({ user: { proUntil } }) as CurrentUserResponse;

describe("ClientOnlyAdContainer (Pro ad-free)", () => {
  it("removes the slot for an active Pro viewer", () => {
    const { container } = renderWithViewer(
      proViewer(new Date(Date.now() + 30 * DAY)),
    );
    expect(container.firstChild).toBeNull();
  });

  it("keeps ads for an anonymous viewer", async () => {
    renderWithViewer({});
    expect(await screen.findByText("ad: feed_top")).toBeInTheDocument();
  });

  it("keeps ads once the Pro horizon has passed", async () => {
    renderWithViewer(proViewer(new Date(Date.now() - DAY)));
    expect(await screen.findByText("ad: feed_top")).toBeInTheDocument();
  });

  it("fails toward ads-on for a signed-in non-Pro viewer", async () => {
    renderWithViewer({
      user: { proUntil: null },
    } as CurrentUserResponse);
    expect(await screen.findByText("ad: feed_top")).toBeInTheDocument();
  });
});
