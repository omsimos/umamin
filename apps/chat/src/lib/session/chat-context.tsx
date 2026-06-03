import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import { createMockTransport } from "../transport/mock-transport";
import type { ChatTransport, SessionSnapshot } from "./types";

interface ChatSessionValue {
  snapshot: SessionSnapshot;
  findMatch: ChatTransport["findMatch"];
  send: ChatTransport["send"];
  react: ChatTransport["react"];
  setTyping: ChatTransport["setTyping"];
  signalStayConnected: ChatTransport["signalStayConnected"];
  leave: ChatTransport["leave"];
}

const ChatSessionContext = createContext<ChatSessionValue | null>(null);

export function ChatSessionProvider({
  children,
  transport,
}: {
  children: ReactNode;
  transport?: ChatTransport;
}) {
  const transportRef = useRef<ChatTransport | undefined>(transport);
  if (!transportRef.current) transportRef.current = createMockTransport();
  const t = transportRef.current;

  const subscribe = useCallback((cb: () => void) => t.subscribe(cb), [t]);
  const getSnapshot = useCallback(() => t.getSnapshot(), [t]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);

  const value = useMemo<ChatSessionValue>(
    () => ({
      snapshot,
      findMatch: (self) => t.findMatch(self),
      send: (text) => t.send(text),
      react: (id, emoji) => t.react(id, emoji),
      setTyping: (isTyping) => t.setTyping(isTyping),
      signalStayConnected: () => t.signalStayConnected(),
      leave: (reason) => t.leave(reason),
    }),
    [snapshot, t],
  );

  return (
    <ChatSessionContext.Provider value={value}>
      {children}
    </ChatSessionContext.Provider>
  );
}

export function useChatSession(): ChatSessionValue {
  const ctx = use(ChatSessionContext);
  if (!ctx) {
    throw new Error("useChatSession must be used within a ChatSessionProvider");
  }
  return ctx;
}
