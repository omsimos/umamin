import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ClientOnlyAdContainer } from "../src/components/ad-container-client";
import { queryKeys } from "../src/lib/query";
import type { CurrentUserResponse } from "../src/lib/types";

// The ad-free Pro gate. In vitest import.meta.env.DEV is true, so a rendered
// slot shows AdContainer's dev placeholder text ("ad: <placement>") — which is
// exactly the observable this asserts on. The viewer is seeded into the query
// cache (staleTime Infinity), so no /api/me fetch runs.

const DAY = 24 * 60 * 60 * 1000;

function withViewer(viewer?: CurrentUserResponse) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  if (viewer) {
    client.setQueryData<CurrentUserResponse>(queryKeys.currentUser(), viewer);
  }
  return (
    <QueryClientProvider client={client}>
      <ClientOnlyAdContainer placement="feed_top" />
    </QueryClientProvider>
  );
}

function renderWithViewer(viewer: CurrentUserResponse) {
  return render(withViewer(viewer));
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

// The slot used to mount only after hydration and push the feed down by its
// min-height. The server HTML has to carry the box, decided from the same
// query cache the client's first render reads.
describe("ClientOnlyAdContainer server render", () => {
  it("reserves the slot when the server has no viewer", () => {
    expect(renderToString(withViewer())).toContain("min-height:280px");
  });

  it("reserves the slot for a signed-in non-Pro viewer", () => {
    expect(
      renderToString(
        withViewer({ user: { proUntil: null } } as CurrentUserResponse),
      ),
    ).toContain("min-height:280px");
  });

  it("renders nothing for an active Pro viewer", () => {
    expect(
      renderToString(withViewer(proViewer(new Date(Date.now() + DAY)))),
    ).toBe("");
  });
});
