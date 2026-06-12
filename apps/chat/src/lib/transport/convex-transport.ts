import { isRateLimitError } from "@convex-dev/rate-limiter";
import type { ConvexReactClient } from "convex/react";
import type { FunctionReference } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { SessionCredentials } from "../session/session-id";
import {
  type ChatMessage,
  type ChatTransport,
  type FindMatchOptions,
  type GameMode,
  type GamePick,
  IDLE_SNAPSHOT,
  LOADING_SNAPSHOT,
  type SelfIdentity,
  type SendOpts,
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
  credentials: SessionCredentials,
  onRateLimited?: (message: string) => void,
  onError?: (error: unknown) => void,
): ChatTransport {
  const { sessionId, sessionSecret } = credentials;
  const sessionArgs = { sessionId, sessionSecret };
  // Meta (status/typing/stay-connected) and the message list are separate
  // reactive queries so typing/presence churn never re-reads the messages.
  const watchMeta = client.watchQuery(api.chat.snapshot, sessionArgs);
  const watchMessages = client.watchQuery(api.chat.messages, sessionArgs);
  let cached: SessionSnapshot = IDLE_SNAPSHOT;
  // Optimistic "matching" shown the instant findMatch is called so neither the
  // lobby -> /chat hop nor a rematch flashes the old chat / bounces (the mock
  // emits "matching" synchronously; this gives the real backend parity). It is
  // HELD until the server reports a different match (or a fresh idle/matching),
  // and cleared on leave/failure — so a failed rematch resolves to idle and the
  // route bounces to the lobby rather than stranding. pendingLeftMatchId is the
  // match being replaced; while the server still reports it, keep "matching".
  let pending: SessionSnapshot | null = null;
  let pendingLeftMatchId = "";
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
      pendingLeftMatchId = "";
      return IDLE_SNAPSHOT;
    }
    if (pending) {
      // Hold the optimistic "matching" while the server still reports the match
      // we're leaving (a rematch) or hasn't resolved past idle; once a real,
      // different phase arrives it wins.
      const stillPriorMatch =
        !!meta && meta.matchId !== "" && meta.matchId === pendingLeftMatchId;
      if (!meta || meta.phase === "idle" || stillPriorMatch) return pending;
      pending = null;
      pendingLeftMatchId = "";
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
    client.mutation(fn, { ...sessionArgs, ...args }).catch(surfaceError);
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
    findMatch(self: SelfIdentity, options?: FindMatchOptions) {
      // Show "matching" immediately (held across a rematch via the match we're
      // leaving) so the lobby -> /chat hop never bounces and a rematch never
      // flashes the old chat; roll back if the enqueue fails so the route can
      // recover (idle -> lobby).
      pendingLeftMatchId = cached.matchId;
      pending = { ...IDLE_SNAPSHOT, phase: "matching", self };
      emit();
      client
        .mutation(api.match.enqueueAndMatch, {
          ...sessionArgs,
          alias: self.alias,
          avatarSeed: self.avatarSeed,
          interests: self.interests,
          ...(options?.inviteCode ? { inviteCode: options.inviteCode } : {}),
          ...(options?.joinCode ? { joinCode: options.joinCode } : {}),
        })
        .then((result: { viaInvite: boolean } | undefined) => {
          if (options?.joinCode && !result?.viaInvite) {
            options.onInviteMiss?.();
          }
        })
        .catch((error: unknown) => {
          pending = null;
          pendingLeftMatchId = "";
          emit();
          surfaceError(error);
        });
    },
    send(text: string, opts?: SendOpts) {
      call(api.chat.send, {
        text,
        ...(opts?.replyToId ? { replyToId: opts.replyToId } : {}),
        ...(opts?.whisper ? { whisper: true } : {}),
        ...(opts?.effect ? { effect: opts.effect } : {}),
      });
    },
    react(messageId: string, emoji: string) {
      call(api.chat.react, { messageId, emoji });
    },
    viewWhisper(messageId: string) {
      call(api.chat.viewWhisper, { messageId });
    },
    dealCard(cardId: string, mode?: GameMode) {
      call(api.games.dealCard, { cardId, ...(mode ? { mode } : {}) });
    },
    answerCard(cardId: string, pick: GamePick) {
      call(api.games.answerCard, { cardId, pick });
    },
    dismissGame() {
      call(api.games.dismissGame, {});
    },
    setTyping(isTyping: boolean) {
      // Best-effort presence signal — never toast or throw on failure.
      client
        .mutation(api.chat.setTyping, { ...sessionArgs, typing: isTyping })
        .catch(() => {});
    },
    signalStayConnected() {
      call(api.chat.signalStayConnected, {});
    },
    submitRevealHandle(handle: string) {
      call(api.reveal.submitReveal, { handle });
    },
    withdrawRevealHandle() {
      call(api.reveal.withdrawReveal, {});
    },
    leave() {
      // Clear any optimistic "matching" so cancelling doesn't strand the UI.
      pending = null;
      pendingLeftMatchId = "";
      emit();
      call(api.chat.leave, {});
    },
  };
}
