import { isRateLimitError } from "@convex-dev/rate-limiter";
import type { ConvexReactClient } from "convex/react";
import type { FunctionReference } from "convex/server";
import { api } from "../../../convex/_generated/api";
import {
  type ChatTransport,
  type EndedReason,
  IDLE_SNAPSHOT,
  type SelfIdentity,
  type SessionSnapshot,
} from "../session/types";

// The snapshot query already returns the SessionSnapshot shape, so mapping is
// identity. Stable identity matters: only swap the cached snapshot when the
// value actually changes, otherwise useSyncExternalStore churns on every emit.
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
): ChatTransport {
  const watch = client.watchQuery(api.chat.snapshot, { sessionId });
  let cached: SessionSnapshot = IDLE_SNAPSHOT;

  function current(): SessionSnapshot {
    // localQueryResult() throws if the query errored on the server; treat that
    // (and the not-yet-resolved undefined) as idle rather than crashing render.
    let result: SessionSnapshot | undefined;
    try {
      result = watch.localQueryResult() as SessionSnapshot | undefined;
    } catch {
      result = undefined;
    }
    if (!result) return IDLE_SNAPSHOT;
    if (sameSnapshot(result, cached)) return cached;
    cached = result;
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
      throw error;
    });
  }

  return {
    subscribe(listener) {
      return watch.onUpdate(() => listener(current()));
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
    signalStayConnected() {
      call(api.chat.signalStayConnected, {});
    },
    leave(reason?: EndedReason) {
      call(api.chat.leave, { reason: reason ?? "self-ended" });
    },
  };
}
