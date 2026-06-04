import { act, render } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QUEUE_PING_MS } from "../../../convex/constants";
import { QueueHeartbeat } from "./queue-heartbeat";

const { fakeConvex } = vi.hoisted(() => ({
  fakeConvex: {
    url: "https://convex.test",
    mutation: vi.fn(async (..._args: unknown[]) => null),
  },
}));

vi.mock("convex/react", () => ({
  useConvex: () => fakeConvex,
}));

describe("QueueHeartbeat", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fakeConvex.mutation.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("pings stillWaiting on mount and on every cadence, and stops on unmount", async () => {
    const { unmount } = render(<QueueHeartbeat />);
    await act(async () => {});
    expect(fakeConvex.mutation).toHaveBeenCalledTimes(1);
    // `api.*` mints a fresh proxy reference per access — compare by name.
    expect(getFunctionName(fakeConvex.mutation.mock.calls[0][0] as never)).toBe(
      "match:stillWaiting",
    );

    await act(async () => {
      vi.advanceTimersByTime(QUEUE_PING_MS * 2);
    });
    expect(fakeConvex.mutation).toHaveBeenCalledTimes(3);

    unmount();
    await act(async () => {
      vi.advanceTimersByTime(QUEUE_PING_MS * 2);
    });
    expect(fakeConvex.mutation).toHaveBeenCalledTimes(3);
  });
});
