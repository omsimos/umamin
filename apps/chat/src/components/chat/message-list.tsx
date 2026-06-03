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
  header?: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const didInitialScroll = useRef(false);

  // Scroll the container itself (never scrollIntoView — that scrolls outer
  // ancestors too and can shove the whole chat off-screen). Jump on first
  // content and own sends; otherwise only when already near the bottom so we
  // don't yank the user down while they read history.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on new content
  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    if (!didInitialScroll.current && messages.length > 0) {
      didInitialScroll.current = true;
      c.scrollTop = c.scrollHeight;
      return;
    }
    const last = messages[messages.length - 1];
    const nearBottom = c.scrollHeight - c.scrollTop - c.clientHeight < 120;
    if (last?.author === "self" || nearBottom) {
      // jsdom (tests) has no element.scrollTo
      if (typeof c.scrollTo === "function") {
        c.scrollTo({ top: c.scrollHeight, behavior: "smooth" });
      } else {
        c.scrollTop = c.scrollHeight;
      }
    }
  }, [messages.length, partnerStatus]);

  return (
    <div
      ref={containerRef}
      className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-4"
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
    </div>
  );
}
