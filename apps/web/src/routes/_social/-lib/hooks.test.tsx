import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useIntersectionLoadMore } from "./hooks";

class TestIntersectionObserver implements IntersectionObserver {
  static latest: TestIntersectionObserver | null = null;

  private readonly callback: IntersectionObserverCallback;
  readonly root = null;
  readonly rootMargin = "0px";
  readonly scrollMargin = "0px";
  readonly thresholds = [0];

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    TestIntersectionObserver.latest = this;
  }

  disconnect() {}
  observe() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  unobserve() {}

  trigger(isIntersecting: boolean) {
    this.callback([{ isIntersecting } as IntersectionObserverEntry], this);
  }
}

function InfiniteLoadHarness({
  onLoadMore,
  isFetchingNextPage = false,
  isFetchNextPageError = false,
  loadMoreKey = "first-page-cursor",
}: {
  onLoadMore: () => Promise<unknown>;
  isFetchingNextPage?: boolean;
  isFetchNextPageError?: boolean;
  loadMoreKey?: string | null;
}) {
  const { setSentinel } = useIntersectionLoadMore<HTMLDivElement>({
    hasNextPage: true,
    isFetchingNextPage,
    isFetchNextPageError,
    loadMoreKey,
    onLoadMore,
  });

  return <div ref={setSentinel} />;
}

describe("useIntersectionLoadMore", () => {
  afterEach(() => {
    TestIntersectionObserver.latest = null;
    vi.unstubAllGlobals();
  });

  it("loads the next page when the sentinel first enters the viewport", async () => {
    vi.stubGlobal("IntersectionObserver", TestIntersectionObserver);
    const onLoadMore = vi.fn().mockResolvedValue(undefined);

    render(<InfiniteLoadHarness onLoadMore={onLoadMore} />);

    await act(async () => {
      TestIntersectionObserver.latest?.trigger(true);
    });

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  // A refresh that trims back to page 1, or a cancelled next-page fetch that
  // reverts, settles with the same cursor the guard already holds.
  it("loads the same cursor again after a next-page fetch settles cleanly", async () => {
    vi.stubGlobal("IntersectionObserver", TestIntersectionObserver);
    const onLoadMore = vi.fn().mockResolvedValue(undefined);

    const { rerender } = render(
      <InfiniteLoadHarness onLoadMore={onLoadMore} loadMoreKey="c1" />,
    );
    await act(async () => {
      TestIntersectionObserver.latest?.trigger(true);
    });

    rerender(
      <InfiniteLoadHarness
        onLoadMore={onLoadMore}
        loadMoreKey="c1"
        isFetchingNextPage
      />,
    );
    rerender(<InfiniteLoadHarness onLoadMore={onLoadMore} loadMoreKey="c1" />);
    await act(async () => {
      TestIntersectionObserver.latest?.trigger(true);
    });

    expect(onLoadMore).toHaveBeenCalledTimes(2);
  });

  it("does not retry the same cursor on its own after a next-page error", async () => {
    vi.stubGlobal("IntersectionObserver", TestIntersectionObserver);
    const onLoadMore = vi.fn().mockResolvedValue(undefined);

    const { rerender } = render(
      <InfiniteLoadHarness onLoadMore={onLoadMore} loadMoreKey="c1" />,
    );
    await act(async () => {
      TestIntersectionObserver.latest?.trigger(true);
    });

    rerender(
      <InfiniteLoadHarness
        onLoadMore={onLoadMore}
        loadMoreKey="c1"
        isFetchingNextPage
      />,
    );
    rerender(
      <InfiniteLoadHarness
        onLoadMore={onLoadMore}
        loadMoreKey="c1"
        isFetchNextPageError
      />,
    );
    await act(async () => {
      TestIntersectionObserver.latest?.trigger(true);
    });

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });
});
