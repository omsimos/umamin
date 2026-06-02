import { ConvexError } from "convex/values";
import { describe, expect, it, vi } from "vitest";
import { IDLE_SNAPSHOT } from "../session/types";
import { createConvexTransport } from "./convex-transport";

// A fake ConvexReactClient implementing only the surface the transport uses:
// watchQuery -> { onUpdate, localQueryResult } and mutation(). The transport
// watches two queries (snapshot + messages), so watchers are kept per query in
// creation order: `_emit` drives the meta (snapshot) query, `_emitMessages` the
// messages query — both fire the subscribed callback, mimicking a server update.
function fakeClient(initialMeta: unknown) {
  const order: { result: unknown; cb: (() => void) | null }[] = [];
  const byQuery = new Map<unknown, (typeof order)[number]>();
  function watcher(query: unknown) {
    let w = byQuery.get(query);
    if (!w) {
      w = { result: order.length === 0 ? initialMeta : undefined, cb: null };
      byQuery.set(query, w);
      order.push(w);
    }
    return w;
  }
  function emitTo(index: number, next: unknown) {
    const w = order[index];
    if (!w) return;
    w.result = next;
    w.cb?.();
  }
  return {
    watchQuery: (query: unknown) => {
      const w = watcher(query);
      return {
        onUpdate: (fn: () => void) => {
          w.cb = fn;
          return () => {
            w.cb = null;
          };
        },
        localQueryResult: () => w.result,
      };
    },
    mutation: vi.fn(async () => {}),
    _emit: (next: unknown) => emitTo(0, next),
    _emitMessages: (next: unknown) => emitTo(1, next),
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

  it("merges the separate messages query into the snapshot", () => {
    const client = fakeClient(undefined);
    // biome-ignore lint/suspicious/noExplicitAny: fake client mirrors the used slice
    const t = createConvexTransport(client as any, "s1");
    // Messages alone (meta unresolved) stays idle.
    client._emitMessages([
      { id: "x1", author: "partner", text: "hi", ts: 1, reactions: [] },
    ]);
    expect(t.getSnapshot()).toEqual(IDLE_SNAPSHOT);
    // Once meta resolves, the message list merges in.
    client._emit({ ...IDLE_SNAPSHOT, phase: "active", matchId: "m1" });
    const snap = t.getSnapshot();
    expect(snap.phase).toBe("active");
    expect(snap.messages).toHaveLength(1);
    expect(snap.messages[0].text).toBe("hi");
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
    const error = new ConvexError({ kind: "RateLimited", name: "sendMessage" });
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

  it("routes a non-rate-limit ConvexError to onError, not onRateLimited", async () => {
    const client = fakeClient({ ...IDLE_SNAPSHOT });
    const error = new ConvexError({ kind: "Unauthorized" });
    client.mutation = vi.fn(async () => {
      throw error;
    });
    const onRateLimited = vi.fn();
    const onError = vi.fn();
    // The transport logs non-rate-limit failures rather than rethrowing them
    // onto a discarded promise; silence the expected log noise.
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const t = createConvexTransport(
      // biome-ignore lint/suspicious/noExplicitAny: fake client mirrors the used slice
      client as any,
      "s1",
      onRateLimited,
      onError,
    );
    t.send("hi");
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(error));
    expect(onRateLimited).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
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
