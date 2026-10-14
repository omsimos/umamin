import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { toast } from "sonner";
import {
  type ChatTransport,
  LOADING_SNAPSHOT,
  type SelfIdentity,
  type SessionSnapshot,
} from "@/lib/chat/types";
import {
  createWsTransport,
  QUEUE_TIMEOUT_MESSAGE,
} from "../transport/ws-transport";
import { getSessionCredentials } from "./session-id";

type ChatActions = Omit<ChatTransport, "subscribe" | "getSnapshot">;

interface ChatSessionValue extends ChatActions {
  snapshot: SessionSnapshot;
}

const ChatSessionContext = createContext<ChatSessionValue | null>(null);

const noopUnsubscribe = () => {};
const loadingSnapshot = () => LOADING_SNAPSHOT;

function bindActions(
  t: ChatTransport | null,
  remember: (self: SelfIdentity) => void,
): ChatActions {
  return {
    findMatch: (self, options) => {
      remember(self);
      t?.findMatch(self, options);
    },
    send: (text, opts) => t?.send(text, opts),
    retrySend: (id) => t?.retrySend(id),
    react: (id, emoji) => t?.react(id, emoji),
    viewWhisper: (id) => t?.viewWhisper(id),
    dealCard: (cardId, mode) => t?.dealCard(cardId, mode),
    answerCard: (cardId, pick) => t?.answerCard(cardId, pick),
    dismissGame: () => t?.dismissGame(),
    setTyping: (isTyping) => t?.setTyping(isTyping),
    signalStayConnected: () => t?.signalStayConnected(),
    submitRevealHandle: (handle) => t?.submitRevealHandle(handle),
    withdrawRevealHandle: () => t?.withdrawRevealHandle(),
    leave: (reason) => t?.leave(reason),
  };
}

/**
 * Owns the chat transport for the /chat routes. The WebSocket transport is
 * created in an effect, so it never exists during SSR: until it does, the
 * snapshot is LOADING_SNAPSHOT, which the routes treat as "hold", not "no
 * session". Tests inject a `transport` instead.
 */
export function ChatSessionProvider({
  children,
  transport,
}: {
  children: ReactNode;
  transport?: ChatTransport;
}) {
  const [created, setCreated] = useState<ChatTransport | null>(null);
  // The identity of the last search, for the queue-timeout "Search again".
  const lastSelf = useRef<SelfIdentity | null>(null);

  useEffect(() => {
    if (transport) return;
    const t = createWsTransport({
      credentials: getSessionCredentials(),
      // One toast per message, not per rejected op: a burst of sends would
      // otherwise stack a copy for each.
      onRateLimited: (message) => toast(message, { id: message }),
      onError: (message) => {
        const self = lastSelf.current;
        if (message === QUEUE_TIMEOUT_MESSAGE && self) {
          // The transport has gone idle and the session bounced to the lobby;
          // the lobby moves back to the radar once the new search starts.
          toast("Still there?", {
            description: message,
            duration: 15_000,
            action: { label: "Search again", onClick: () => t.findMatch(self) },
          });
          return;
        }
        toast.error(message, { id: message });
      },
    });
    setCreated(t);
    return () => {
      t.dispose();
      setCreated(null);
    };
  }, [transport]);

  const t = transport ?? created;

  const subscribe = useCallback(
    (cb: () => void) => (t ? t.subscribe(cb) : noopUnsubscribe),
    [t],
  );
  const getSnapshot = useCallback(
    () => (t ? t.getSnapshot() : LOADING_SNAPSHOT),
    [t],
  );
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    loadingSnapshot,
  );

  // Keyed on the transport only, so the actions keep their identity across
  // snapshots. Without the React Compiler, a fresh setTyping per frame would
  // re-run the composer's cleanup and send typing:off mid-sentence.
  const actions = useMemo(
    () =>
      bindActions(t, (self) => {
        lastSelf.current = self;
      }),
    [t],
  );

  const value = useMemo<ChatSessionValue>(
    () => ({ snapshot, ...actions }),
    [snapshot, actions],
  );

  return <ChatSessionContext value={value}>{children}</ChatSessionContext>;
}

export function useChatSession(): ChatSessionValue {
  const ctx = use(ChatSessionContext);
  if (!ctx) {
    throw new Error("useChatSession must be used within a ChatSessionProvider");
  }
  return ctx;
}
