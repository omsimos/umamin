import { ConvexError } from "convex/values";
import { describe, expect, it, vi } from "vitest";
import { IDLE_SNAPSHOT, LOADING_SNAPSHOT } from "../session/types";
import { createConvexTransport } from "./convex-transport";

const credentials = { sessionId: "s1", sessionSecret: "s1-secret" };

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
    // Loosely typed: tests stub per-case resolutions ({viaInvite}, throws, …).
    mutation: vi.fn(async (): Promise<unknown> => undefined),
    _emit: (next: unknown) => emitTo(0, next),
    _emitMessages: (next: unknown) => emitTo(1, next),
  };
}

describe("convexTransport", () => {
  it("returns a loading snapshot until the meta query resolves", () => {
    const client = fakeClient(undefined);
    // biome-ignore lint/suspicious/noExplicitAny: fake client mirrors the used slice
    const t = createConvexTransport(client as any, credentials);
    expect(t.getSnapshot()).toEqual(LOADING_SNAPSHOT);
    expect(t.getSnapshot().phase).toBe("loading");
  });

  it("maps query results to snapshots and is identity-stable between identical emits", () => {
    const client = fakeClient(undefined);
    // biome-ignore lint/suspicious/noExplicitAny: fake client mirrors the used slice
    const t = createConvexTransport(client as any, credentials);
    const seen: unknown[] = [];
    t.subscribe(() => seen.push(t.getSnapshot()));
    const snap = { ...IDLE_SNAPSHOT, phase: "matching" as const };
    client._emit(snap);
    const first = t.getSnapshot();
    client._emit({ ...snap });
    expect(t.getSnapshot()).toBe(first); // same reference -> no churn
  });

  it("merges the separate messages query into the snapshot", () => {
    const client = fakeClient(undefined);
    // biome-ignore lint/suspicious/noExplicitAny: fake client mirrors the used slice
    const t = createConvexTransport(client as any, credentials);
    client._emitMessages([
      { id: "x1", author: "partner", text: "hi", ts: 1, reactions: [] },
    ]);
    expect(t.getSnapshot()).toEqual(LOADING_SNAPSHOT);
    client._emit({ ...IDLE_SNAPSHOT, phase: "active", matchId: "m1" });
    const snap = t.getSnapshot();
    expect(snap.phase).toBe("active");
    expect(snap.messages).toHaveLength(1);
    expect(snap.messages[0].text).toBe("hi");
  });

  it("send calls the mutation with sessionId", () => {
    const client = fakeClient({ ...IDLE_SNAPSHOT });
    // biome-ignore lint/suspicious/noExplicitAny: fake client mirrors the used slice
    const t = createConvexTransport(client as any, credentials);
    t.send("hi");
    expect(client.mutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        sessionId: "s1",
        sessionSecret: "s1-secret",
        text: "hi",
      }),
    );
  });

  it("send forwards a reply target and omits the field when absent", () => {
    const client = fakeClient({ ...IDLE_SNAPSHOT });
    // biome-ignore lint/suspicious/noExplicitAny: fake client mirrors the used slice
    const t = createConvexTransport(client as any, credentials);
    t.send("hi", { replyToId: "m9" });
    expect(client.mutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ text: "hi", replyToId: "m9" }),
    );
    t.send("plain");
    const [, args] = (client.mutation as ReturnType<typeof vi.fn>).mock
      .calls[1];
    expect(args).not.toHaveProperty("replyToId");
    expect(args).not.toHaveProperty("whisper");
    expect(args).not.toHaveProperty("effect");
  });

  it("send forwards whisper and effect options", () => {
    const client = fakeClient({ ...IDLE_SNAPSHOT });
    // biome-ignore lint/suspicious/noExplicitAny: fake client mirrors the used slice
    const t = createConvexTransport(client as any, credentials);
    t.send("psst", { whisper: true });
    expect(client.mutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ text: "psst", whisper: true }),
    );
    t.send("yay", { effect: "confetti" });
    expect(client.mutation).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ text: "yay", effect: "confetti" }),
    );
  });

  it("viewWhisper calls the mutation with session args", () => {
    const client = fakeClient({ ...IDLE_SNAPSHOT });
    // biome-ignore lint/suspicious/noExplicitAny: fake client mirrors the used slice
    const t = createConvexTransport(client as any, credentials);
    t.viewWhisper("m3");
    expect(client.mutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        sessionId: "s1",
        sessionSecret: "s1-secret",
        messageId: "m3",
      }),
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
    const t = createConvexTransport(client as any, credentials);
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
      credentials,
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
      credentials,
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
    const t = createConvexTransport(client as any, credentials);

    t.findMatch({ alias: "a", avatarSeed: "seed", interests: ["music"] });
    t.react("m1", "❤️");
    t.signalStayConnected();
    t.leave();

    for (const [, args] of (client.mutation as ReturnType<typeof vi.fn>).mock
      .calls) {
      expect(args).toMatchObject({
        sessionId: "s1",
        sessionSecret: "s1-secret",
      });
    }
    expect(client.mutation).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        sessionId: "s1",
        sessionSecret: "s1-secret",
      }),
    );
  });

  it("forwards invite/join codes and reports a miss only on a failed join", async () => {
    const client = fakeClient({ ...IDLE_SNAPSHOT });
    client.mutation = vi.fn(async () => ({ viaInvite: false }));
    const onInviteMiss = vi.fn();
    // biome-ignore lint/suspicious/noExplicitAny: fake client mirrors the used slice
    const t = createConvexTransport(client as any, credentials);
    t.findMatch(
      { alias: "a", avatarSeed: "seed", interests: [] },
      { inviteCode: "mine", joinCode: "theirs", onInviteMiss },
    );
    expect(client.mutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ inviteCode: "mine", joinCode: "theirs" }),
    );
    await vi.waitFor(() => expect(onInviteMiss).toHaveBeenCalledTimes(1));

    // A successful join never reports a miss.
    client.mutation = vi.fn(async () => ({ viaInvite: true }));
    const onHit = vi.fn();
    t.findMatch(
      { alias: "a", avatarSeed: "seed", interests: [] },
      { joinCode: "theirs", onInviteMiss: onHit },
    );
    await vi.waitFor(() => expect(client.mutation).toHaveBeenCalled());
    await Promise.resolve();
    expect(onHit).not.toHaveBeenCalled();
  });

  it("does not report a miss without a joinCode", async () => {
    const client = fakeClient({ ...IDLE_SNAPSHOT });
    client.mutation = vi.fn(async () => ({ viaInvite: false }));
    const onInviteMiss = vi.fn();
    // biome-ignore lint/suspicious/noExplicitAny: fake client mirrors the used slice
    const t = createConvexTransport(client as any, credentials);
    t.findMatch(
      { alias: "a", avatarSeed: "seed", interests: [] },
      { inviteCode: "mine", onInviteMiss },
    );
    await vi.waitFor(() => expect(client.mutation).toHaveBeenCalled());
    await Promise.resolve();
    expect(onInviteMiss).not.toHaveBeenCalled();
  });

  it("optimistically reports matching the instant findMatch is called", () => {
    const client = fakeClient(undefined);
    // biome-ignore lint/suspicious/noExplicitAny: fake client mirrors the used slice
    const t = createConvexTransport(client as any, credentials);
    client._emit({ ...IDLE_SNAPSHOT });
    expect(t.getSnapshot().phase).toBe("idle");
    // findMatch must flip to "matching" synchronously so /chat doesn't bounce.
    t.findMatch({ alias: "a", avatarSeed: "seed", interests: ["music"] });
    expect(t.getSnapshot().phase).toBe("matching");
    expect(client.mutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        sessionId: "s1",
        sessionSecret: "s1-secret",
        interests: ["music"],
      }),
    );
  });

  it("holds optimistic matching across a rematch until a different match resolves", () => {
    const client = fakeClient(undefined);
    // biome-ignore lint/suspicious/noExplicitAny: fake client mirrors the used slice
    const t = createConvexTransport(client as any, credentials);
    client._emit({ ...IDLE_SNAPSHOT, phase: "active", matchId: "m1" });
    expect(t.getSnapshot().phase).toBe("active");
    // Rematch while the server still reports the old match: show matching, not
    // the stale chat (and don't bounce).
    t.findMatch({ alias: "a", avatarSeed: "seed", interests: ["music"] });
    expect(t.getSnapshot().phase).toBe("matching");
    client._emit({ ...IDLE_SNAPSHOT, phase: "active", matchId: "m1" });
    expect(t.getSnapshot().phase).toBe("matching");
    client._emit({ ...IDLE_SNAPSHOT, phase: "active", matchId: "m2" });
    expect(t.getSnapshot().phase).toBe("active");
    expect(t.getSnapshot().matchId).toBe("m2");
  });

  it("rolls back to idle when findMatch fails so the route can recover", async () => {
    const client = fakeClient(undefined);
    const onError = vi.fn();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    client.mutation = vi.fn(async () => {
      throw new Error("enqueue failed");
    });
    const t = createConvexTransport(
      // biome-ignore lint/suspicious/noExplicitAny: fake client mirrors the used slice
      client as any,
      credentials,
      undefined,
      onError,
    );
    client._emit({ ...IDLE_SNAPSHOT });
    t.findMatch({ alias: "a", avatarSeed: "seed", interests: ["music"] });
    expect(t.getSnapshot().phase).toBe("matching");
    await vi.waitFor(() => expect(onError).toHaveBeenCalled());
    // After rollback the snapshot resolves to idle (route bounces, no strand).
    expect(t.getSnapshot().phase).toBe("idle");
    consoleError.mockRestore();
  });
});
