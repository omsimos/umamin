import { isRateLimitError } from "@convex-dev/rate-limiter";
import type { ConvexReactClient } from "convex/react";
import type { FunctionReference } from "convex/server";
import { api } from "../../../convex/_generated/api";
import {
  type ChatMessage,
  type ChatTransport,
  IDLE_SNAPSHOT,
  LOADING_SNAPSHOT,
  type SelfIdentity,
  type SessionSnapshot,
  type SnapshotMeta,
} from "../session/types";

// The meta + messages queries are merged into one SessionSnapshot. Stable
// identity matters: only swap the cached snapshot when the value actually
// changes, otherwise useSyncExternalStore churns on every emit.
function sameSnapshot(a: SessionSnapshot, b: SessionSnapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// The fake client in tests implements only the slice of ConvexReactClient the
// transport touches; the real client satisfies this structurally.
type TransportClient = Pick<ConvexReactClient, "watchQuery" | "mutation">;

const RATE_LIMITED_MESSAGE =
  "You're going a little fast — try again in a moment.";

export function createConvexTransport(
  client: TransportClient,
  sessionId: string,
  onRateLimited?: (message: string) => void,
  onError?: (error: unknown) => void,
): ChatTransport {
  // Meta (status/typing/stay-connected) and the message list are separate
  // reactive queries so typing/presence churn never re-reads the messages.
  const watchMeta = client.watchQuery(api.chat.snapshot, { sessionId });
  const watchMessages = client.watchQuery(api.chat.messages, { sessionId });
  let cached: SessionSnapshot = IDLE_SNAPSHOT;
  // Optimistic "matching" shown the instant findMatch is called, so navigating
  // to /chat never observes a resolved-idle snapshot and bounces back to the
  // lobby (the mock emits "matching" synchronously; this gives the real backend
  // parity). Cleared once the server reflects a real phase, or on leave/failure.
  let pending: SessionSnapshot | null = null;
  const listeners = new Set<(snapshot: SessionSnapshot) => void>();

  // localQueryResult() throws if the query errored on the server; treat that
  // (and the not-yet-resolved undefined) as the fallback rather than crashing.
  function read<T>(watch: { localQueryResult: () => unknown }, fallback: T): T {
    try {
      return (watch.localQueryResult() ?? fallback) as T;
    } catch {
      return fallback;
    }
  }

  function current(): SessionSnapshot {
    let meta: SnapshotMeta | undefined;
    try {
      meta = watchMeta.localQueryResult() as SnapshotMeta | undefined;
    } catch {
      // The meta query errored — drop any optimistic state and resolve to idle
      // so the route falls back to the lobby instead of spinning forever.
      pending = null;
      return IDLE_SNAPSHOT;
    }
    if (pending) {
      // Hold the optimistic snapshot until the server reflects a real phase.
      if (!meta || meta.phase === "idle") return pending;
      pending = null;
    }
    // Not resolved yet (e.g. a fresh reload): a distinct "loading" phase so the
    // route holds rather than bouncing to the lobby on a transient idle.
    if (!meta) return LOADING_SNAPSHOT;
    const messages = read<ChatMessage[]>(watchMessages, []);
    const merged: SessionSnapshot = { ...meta, messages };
    if (sameSnapshot(merged, cached)) return cached;
    cached = merged;
    return cached;
  }

  function emit() {
    const snapshot = current();
    for (const listener of listeners) listener(snapshot);
  }

  // Fan the reactive queries out to all listeners once. The transport is a
  // singleton for the app's lifetime, so these subscriptions never tear down.
  watchMeta.onUpdate(emit);
  watchMessages.onUpdate(emit);
  // Prime the cache so the first getSnapshot reflects any already-resolved value.
  cached = current();

  function surfaceError(error: unknown) {
    if (isRateLimitError(error)) {
      onRateLimited?.(RATE_LIMITED_MESSAGE);
      return;
    }
    // Fire-and-forget mutations (the transport API is void): a rethrow would
    // become an unhandled rejection that reaches no UI. Log + surface instead.
    console.error("chat mutation failed", error);
    onError?.(error);
  }

  function call(
    fn: FunctionReference<"mutation">,
    args: Record<string, unknown>,
  ) {
    client.mutation(fn, { sessionId, ...args }).catch(surfaceError);
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot() {
      return current();
    },
    findMatch(self: SelfIdentity) {
      // Show "matching" immediately so the lobby -> /chat hop doesn't bounce on
      // a resolved-idle snapshot; roll back if the enqueue fails.
      pending = { ...IDLE_SNAPSHOT, phase: "matching", self };
      emit();
      client
        .mutation(api.match.enqueueAndMatch, {
          sessionId,
          alias: self.alias,
          avatarSeed: self.avatarSeed,
          interests: self.interests,
        })
        .catch((error: unknown) => {
          pending = null;
          emit();
          surfaceError(error);
        });
    },
    send(text: string) {
      call(api.chat.send, { text });
    },
    react(messageId: string, emoji: string) {
      call(api.chat.react, { messageId, emoji });
    },
    setTyping(isTyping: boolean) {
      // Best-effort presence signal — never toast or throw on failure.
      client
        .mutation(api.chat.setTyping, { sessionId, typing: isTyping })
        .catch(() => {});
    },
    signalStayConnected() {
      call(api.chat.signalStayConnected, {});
    },
    leave() {
      // Clear any optimistic "matching" so cancelling doesn't strand the UI.
      pending = null;
      emit();
      call(api.chat.leave, {});
    },
  };
}
