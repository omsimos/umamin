import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IpDenylistManager } from "./ip-denylist-manager";

vi.mock("@/lib/api", () => ({ callAction: vi.fn() }));

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("IpDenylistManager", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports a failed load instead of an empty denylist, and retries", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ error: "Internal error" }, 500))
      .mockResolvedValueOnce(json({ ips: ["203.0.113.7"] }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <IpDenylistManager />
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));

    expect(await screen.findByText("203.0.113.7")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
