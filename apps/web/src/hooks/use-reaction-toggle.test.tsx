import { act, renderHook, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureException } from "@/lib/posthog";
import { BURST_ACTION_REJECT_MESSAGE } from "./use-burst-action";
import { useReactionToggle } from "./use-reaction-toggle";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));
vi.mock("@/lib/posthog", () => ({ captureException: vi.fn() }));

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

type Overrides = Partial<Parameters<typeof useReactionToggle>[0]>;

function setup(overrides: Overrides = {}) {
  const request = vi.fn(async (_next: boolean): Promise<unknown> => ({
    success: true,
  }));
  const isNoop = vi.fn(
    (res: unknown) => !!res && typeof res === "object" && "alreadyLiked" in res,
  );
  const onResponse = vi.fn();
  const writeCache = vi.fn();
  const options = {
    on: false,
    count: 3,
    request,
    isNoop,
    onResponse,
    writeCache,
    fallbackError: "Couldn't update.",
    ...overrides,
  };
  const { result } = renderHook(() => useReactionToggle(options));
  return { result, request: options.request, onResponse, writeCache };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useReactionToggle", () => {
  it("counts a changed response and writes the confirmed state", async () => {
    const { result, writeCache, onResponse } = setup();

    await act(async () => {
      result.current.toggle();
    });

    await waitFor(() => expect(writeCache).toHaveBeenCalledTimes(1));
    expect(writeCache).toHaveBeenCalledWith({ on: true, count: 4 });
    expect(onResponse).toHaveBeenCalledWith(true, false);
    expect(result.current.on).toBe(true);
    expect(result.current.count).toBe(4);
  });

  it("takes the server's count on a no-op", async () => {
    const { result, writeCache, onResponse } = setup({
      request: vi.fn(async () => ({ alreadyLiked: true, count: 9 })),
    });

    await act(async () => {
      result.current.toggle();
    });

    await waitFor(() => expect(writeCache).toHaveBeenCalledTimes(1));
    expect(writeCache).toHaveBeenCalledWith({ on: true, count: 9 });
    expect(onResponse).toHaveBeenCalledWith(true, true);
  });

  it("rolls back, toasts and reports an error response", async () => {
    const { result, writeCache, onResponse } = setup({
      request: vi.fn(async () => ({ error: "Nope" })),
      errorSource: "x",
    });

    await act(async () => {
      result.current.toggle();
    });

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Nope"));
    expect(result.current.on).toBe(false);
    expect(result.current.count).toBe(3);
    expect(writeCache).not.toHaveBeenCalled();
    expect(onResponse).not.toHaveBeenCalled();
    expect(captureException).toHaveBeenCalledWith(expect.any(Error), {
      source: "x",
    });
  });

  it("does not report a failure when no error source is given", async () => {
    const { result } = setup({
      request: vi.fn(async () => ({ error: "Nope" })),
    });

    await act(async () => {
      result.current.toggle();
    });

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Nope"));
    expect(captureException).not.toHaveBeenCalled();
  });

  it("toasts the fallback for a failure that is not an Error", async () => {
    // The rate limiter wraps a non-Error rejection from `request` in an Error,
    // so the non-Error has to come from a callback that runs outside it.
    const { result } = setup({
      onResponse: () => {
        throw "boom";
      },
    });

    await act(async () => {
      result.current.toggle();
    });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Couldn't update."),
    );
    expect(result.current.on).toBe(false);
  });

  it("sends one follow-up for a tap made while the first request is pending", async () => {
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    const request = vi
      .fn<(next: boolean) => Promise<unknown>>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result, writeCache } = setup({ request });

    act(() => {
      result.current.toggle();
      result.current.toggle();
    });
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenLastCalledWith(true);

    await act(async () => first.resolve({ success: true }));

    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    expect(request).toHaveBeenLastCalledWith(false);
    expect(writeCache).not.toHaveBeenCalled();

    await act(async () => second.resolve({ success: true }));

    await waitFor(() => expect(writeCache).toHaveBeenCalledTimes(1));
    expect(writeCache).toHaveBeenCalledWith({ on: false, count: 3 });
  });

  it("refuses a request past the burst limit", async () => {
    const { result, request, writeCache } = setup({ burstLimit: 2 });

    for (let sent = 1; sent <= 2; sent++) {
      await act(async () => {
        result.current.toggle();
      });
      await waitFor(() => expect(writeCache).toHaveBeenCalledTimes(sent));
    }

    await act(async () => {
      result.current.toggle();
    });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(BURST_ACTION_REJECT_MESSAGE),
    );
    expect(request).toHaveBeenCalledTimes(2);
  });
});
