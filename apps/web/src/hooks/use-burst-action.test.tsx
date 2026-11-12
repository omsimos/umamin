import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  BURST_ACTION_REJECT_MESSAGE,
  useBurstAction,
} from "./use-burst-action";

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("useBurstAction", () => {
  it("returns the action's result when the component unmounted mid-request", async () => {
    const d = deferred<{ error: string }>();
    const action = vi.fn((_liked: boolean) => d.promise);
    const { result, unmount } = renderHook(() => useBurstAction(action));

    const p = result.current(true);
    unmount();
    d.resolve({ error: "nope" });

    expect(await p).toEqual({ error: "nope" });
  });

  it("rejects when a call settles without a result", async () => {
    const action = vi.fn(async () => undefined);
    const { result } = renderHook(() => useBurstAction(action));

    await expect(result.current()).rejects.toThrow();
  });

  it("rejects with the burst message past the limit", async () => {
    const action = vi.fn(async () => ({}));
    const { result } = renderHook(() => useBurstAction(action, { limit: 1 }));

    await result.current();
    await expect(result.current()).rejects.toThrow(BURST_ACTION_REJECT_MESSAGE);
  });
});
