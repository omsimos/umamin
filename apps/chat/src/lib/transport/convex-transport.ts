import { isRateLimitError } from "@convex-dev/rate-limiter";
import type { ConvexReactClient } from "convex/react";
import type { FunctionReference } from "convex/server";
import { api } from "../../../convex/_generated/api";
import {
  type ChatMessage,
  type ChatTransport,
  type EndedReason,
  IDLE_SNAPSHOT,
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
    const meta = read<SnapshotMeta | undefined>(watchMeta, undefined);
    if (!meta) return IDLE_SNAPSHOT;
    const messages = read<ChatMessage[]>(watchMessages, []);
    const merged: SessionSnapshot = { ...meta, messages };
    if (sameSnapshot(merged, cached)) return cached;
    cached = merged;
    return cached;
  }
  // Prime the cache so the first getSnapshot reflects any already-resolved value.
  cached = current();

  function call(
    fn: FunctionReference<"mutation">,
    args: Record<string, unknown>,
  ) {
    client.mutation(fn, { sessionId, ...args }).catch((error: unknown) => {
      // Only the rate limiter's ConvexError maps to the toast; any other
      // ConvexError (validation/auth/missing session) must surface, not be
      // misreported as "going a little fast" and swallowed.
      if (isRateLimitError(error)) {
        onRateLimited?.(RATE_LIMITED_MESSAGE);
        return;
      }
      // This promise is fire-and-forget (the transport API is void), so a
      // rethrow here would become an unhandled rejection that reaches no UI.
      // Log it and hand it to the caller-supplied surface instead.
      console.error("chat mutation failed", error);
      onError?.(error);
    });
  }

  return {
    subscribe(listener) {
      const emit = () => listener(current());
      const unMeta = watchMeta.onUpdate(emit);
      const unMessages = watchMessages.onUpdate(emit);
      return () => {
        unMeta();
        unMessages();
      };
    },
    getSnapshot() {
      return current();
    },
    findMatch(self: SelfIdentity) {
      call(api.match.enqueueAndMatch, {
        alias: self.alias,
        avatarSeed: self.avatarSeed,
        interests: self.interests,
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
    leave(reason?: EndedReason) {
      call(api.chat.leave, { reason: reason ?? "self-ended" });
    },
  };
}
