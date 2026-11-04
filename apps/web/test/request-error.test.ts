import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPostsPage } from "../src/lib/query-fetchers";
import { RequestFailedError } from "../src/lib/request-error";

describe("fetch errors", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the HTTP status so a rate limit is distinguishable from a 500", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 429 })),
    );

    const error = await fetchPostsPage(null, true, "hot").catch((e) => e);

    expect(error).toBeInstanceOf(RequestFailedError);
    expect(error.status).toBe(429);
    expect(error.message).toContain("(429)");
  });
});
