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

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on new content
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, partnerStatus]);

  return (
    <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-4">
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
