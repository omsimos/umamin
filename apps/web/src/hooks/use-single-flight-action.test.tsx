import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSingleFlightAction } from "./use-single-flight-action";

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("useSingleFlightAction", () => {
  it("shares one in-flight call for an identical payload", async () => {
    const d = deferred<string>();
    const action = vi.fn((_input: { content: string }) => d.promise);
    const { result } = renderHook(() => useSingleFlightAction(action));

    const a = result.current({ content: "hi" });
    const b = result.current({ content: "hi" });
    expect(action).toHaveBeenCalledTimes(1);
    d.resolve("ok");
    expect(await a).toBe("ok");
    expect(await b).toBe("ok");
  });

  it("runs a different payload as its own call instead of returning the first result", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const action = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const { result } = renderHook(() => useSingleFlightAction(action));

    const a = result.current({ content: "one" });
    const b = result.current({ content: "two" });
    expect(action).toHaveBeenCalledTimes(2);
    first.resolve("r1");
    second.resolve("r2");
    expect(await a).toBe("r1");
    expect(await b).toBe("r2");
  });
});
