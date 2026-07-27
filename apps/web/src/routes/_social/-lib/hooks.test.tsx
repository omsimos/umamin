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
}: {
  onLoadMore: () => Promise<unknown>;
}) {
  const { setSentinel } = useIntersectionLoadMore<HTMLDivElement>({
    hasNextPage: true,
    isFetchingNextPage: false,
    loadMoreKey: "first-page-cursor",
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
});
