import { afterEach, describe, expect, it, vi } from "vitest";
import { bufferEarlyErrors, whenIdle } from "@/lib/early-errors";

function rejection(reason: unknown) {
  return Object.assign(new Event("unhandledrejection"), { reason });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("bufferEarlyErrors", () => {
  it("replays errors and rejections raised before the tracker loaded", () => {
    const buffer = bufferEarlyErrors(10);
    const error = new ErrorEvent("error", { error: new Error("boom") });
    const rejected = rejection(new Error("nope"));
    window.dispatchEvent(error);
    window.dispatchEvent(rejected);

    const capture = vi.fn();
    buffer.flush(capture);

    expect(capture.mock.calls.map(([event]) => event)).toEqual([
      error,
      rejected,
    ]);
  });

  it("keeps only the first few of a burst", () => {
    const buffer = bufferEarlyErrors(3);
    for (let i = 0; i < 20; i++) {
      window.dispatchEvent(new ErrorEvent("error", { message: `e${i}` }));
    }

    const capture = vi.fn();
    buffer.flush(capture);

    expect(capture).toHaveBeenCalledTimes(3);
  });

  // Once the SDK is up its own handlers report, so a listener left behind
  // would hold events forever.
  it("stops listening after the flush", () => {
    const buffer = bufferEarlyErrors(10);
    const capture = vi.fn();
    buffer.flush(capture);

    window.dispatchEvent(new ErrorEvent("error", { message: "late" }));
    buffer.flush(capture);

    expect(capture).not.toHaveBeenCalled();
  });
});

describe("whenIdle", () => {
  it("waits for an idle callback with a deadline", () => {
    const requestIdleCallback = vi.fn();
    vi.stubGlobal("requestIdleCallback", requestIdleCallback);
    const task = vi.fn();

    whenIdle(task, 4_000);

    expect(task).not.toHaveBeenCalled();
    expect(requestIdleCallback).toHaveBeenCalledWith(task, { timeout: 4_000 });
  });

  it("falls back to a timer without requestIdleCallback", () => {
    vi.stubGlobal("requestIdleCallback", undefined);
    vi.useFakeTimers();
    const task = vi.fn();

    whenIdle(task, 4_000);
    vi.advanceTimersByTime(3_999);
    expect(task).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(task).toHaveBeenCalledTimes(1);
  });
});
