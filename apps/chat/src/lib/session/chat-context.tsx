import {
  createContext,
  type ReactNode,
  useContext,
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
  signalStayConnected: ChatTransport["signalStayConnected"];
  leave: ChatTransport["leave"];
}

const ChatSessionContext = createContext<ChatSessionValue | null>(null);

export function ChatSessionProvider({
  children,
  transport,
}: {
  children: ReactNode;
  /** Swap point: defaults to the mock; a Convex transport drops in here later. */
  transport?: ChatTransport;
}) {
  const transportRef = useRef<ChatTransport | undefined>(transport);
  if (!transportRef.current) transportRef.current = createMockTransport();
  const t = transportRef.current;

  const snapshot = useSyncExternalStore(
    (cb) => t.subscribe(cb),
    () => t.getSnapshot(),
  );

  const value = useMemo<ChatSessionValue>(
    () => ({
      snapshot,
      findMatch: (self) => t.findMatch(self),
      send: (text) => t.send(text),
      react: (id, emoji) => t.react(id, emoji),
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
  const ctx = useContext(ChatSessionContext);
  if (!ctx) {
    throw new Error("useChatSession must be used within a ChatSessionProvider");
  }
  return ctx;
}
