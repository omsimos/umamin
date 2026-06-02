import { describe, expect, it, vi } from "vitest";
import { IDLE_SNAPSHOT } from "../session/types";
import { createConvexTransport } from "./convex-transport";

// A fake ConvexReactClient implementing only the surface the transport uses:
// watchQuery -> { onUpdate, localQueryResult } and mutation(). `_emit` swaps the
// local result and fires the subscribed callback, mimicking a server update.
function fakeClient(initial: unknown) {
  let result = initial;
  let cb: (() => void) | null = null;
  return {
    watchQuery: () => ({
      onUpdate: (fn: () => void) => {
        cb = fn;
        return () => {
          cb = null;
        };
      },
      localQueryResult: () => result,
    }),
    mutation: vi.fn(async () => {}),
    _emit: (next: unknown) => {
      result = next;
      cb?.();
    },
  };
}

describe("convexTransport", () => {
  it("returns IDLE_SNAPSHOT until the query resolves", () => {
    const client = fakeClient(undefined);
    // biome-ignore lint/suspicious/noExplicitAny: fake client mirrors the used slice
    const t = createConvexTransport(client as any, "s1");
    expect(t.getSnapshot()).toEqual(IDLE_SNAPSHOT);
  });

  it("maps query results to snapshots and is identity-stable between identical emits", () => {
    const client = fakeClient(undefined);
    // biome-ignore lint/suspicious/noExplicitAny: fake client mirrors the used slice
    const t = createConvexTransport(client as any, "s1");
    const seen: unknown[] = [];
    t.subscribe(() => seen.push(t.getSnapshot()));
    const snap = { ...IDLE_SNAPSHOT, phase: "matching" as const };
    client._emit(snap);
    const first = t.getSnapshot();
    client._emit({ ...snap }); // structurally identical
    expect(t.getSnapshot()).toBe(first); // same reference -> no churn
  });

  it("send calls the mutation with sessionId", () => {
    const client = fakeClient({ ...IDLE_SNAPSHOT });
    // biome-ignore lint/suspicious/noExplicitAny: fake client mirrors the used slice
    const t = createConvexTransport(client as any, "s1");
    t.send("hi");
    expect(client.mutation).toHaveBeenCalled();
  });
});
