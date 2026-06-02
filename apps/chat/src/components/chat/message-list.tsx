import { type ReactNode, useEffect, useRef } from "react";
import type { ChatMessage, PartnerStatus } from "../../lib/session/types";
import { MessageBubble } from "./message-bubble";
import { TypingIndicator } from "./typing-indicator";

export function MessageList({
  messages,
  partnerStatus,
  onReact,
  header,
}: {
  messages: ChatMessage[];
  partnerStatus: PartnerStatus | undefined;
  onReact: (messageId: string, emoji: string) => void;
  /** Optional node rendered above the first message (the ice-breaker). */
  header?: ReactNode;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const didInitialScroll = useRef(false);

  // Auto-scroll to the newest message, but don't yank the user down while
  // they're reading history: jump on first content and on your own sends,
  // otherwise only when already near the bottom.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on new content
  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    if (!didInitialScroll.current && messages.length > 0) {
      didInitialScroll.current = true;
      endRef.current?.scrollIntoView();
      return;
    }
    const last = messages[messages.length - 1];
    const nearBottom = c.scrollHeight - c.scrollTop - c.clientHeight < 120;
    if (last?.author === "self" || nearBottom) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, partnerStatus]);

  return (
    <div
      ref={containerRef}
      className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-4"
    >
      {header}
      {messages.map((m) => (
        <MessageBubble
          key={m.id}
          message={m}
          onReact={(e) => onReact(m.id, e)}
        />
      ))}
      {partnerStatus === "typing" && <TypingIndicator />}
      <div ref={endRef} />
    </div>
  );
}
