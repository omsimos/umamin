import { ConvexError } from "convex/values";
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
    expect(client.mutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ sessionId: "s1", text: "hi" }),
    );
  });

  it("treats a server-side query error as IDLE_SNAPSHOT", () => {
    const client = fakeClient(undefined);
    client.watchQuery = () => ({
      onUpdate: () => () => {},
      localQueryResult: () => {
        throw new Error("server query failed");
      },
    });
    // biome-ignore lint/suspicious/noExplicitAny: fake client mirrors the used slice
    const t = createConvexTransport(client as any, "s1");
    expect(t.getSnapshot()).toEqual(IDLE_SNAPSHOT);
  });

  it("routes a rate-limit ConvexError to onRateLimited and swallows it", async () => {
    const client = fakeClient({ ...IDLE_SNAPSHOT });
    const error = new ConvexError({ kind: "RateLimited" });
    client.mutation = vi.fn(async () => {
      throw error;
    });
    const onRateLimited = vi.fn();
    const t = createConvexTransport(
      // biome-ignore lint/suspicious/noExplicitAny: fake client mirrors the used slice
      client as any,
      "s1",
      onRateLimited,
    );
    t.send("hi");
    await vi.waitFor(() => expect(onRateLimited).toHaveBeenCalledTimes(1));
    expect(onRateLimited).toHaveBeenCalledWith(expect.any(String));
  });

  it("forwards sessionId on every action method", () => {
    const client = fakeClient({ ...IDLE_SNAPSHOT });
    // biome-ignore lint/suspicious/noExplicitAny: fake client mirrors the used slice
    const t = createConvexTransport(client as any, "s1");

    t.findMatch({ alias: "a", avatarSeed: "seed", interests: ["music"] });
    t.react("m1", "❤️");
    t.signalStayConnected();
    t.leave();

    for (const [, args] of (client.mutation as ReturnType<typeof vi.fn>).mock
      .calls) {
      expect(args).toMatchObject({ sessionId: "s1" });
    }
    expect(client.mutation).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ sessionId: "s1", reason: "self-ended" }),
    );
  });
});
