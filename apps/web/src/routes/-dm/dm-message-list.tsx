import { Button } from "@umamin/ui/components/button";
import { Message } from "@umamin/ui/components/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
  useMessageScroller,
} from "@umamin/ui/components/message-scroller";
import { cn } from "@umamin/ui/lib/utils";
import { useEffect, useRef, useState } from "react";
import { seenMessageId, type UiDmMessage } from "@/lib/dm/client-state";
import { TypingIndicator } from "../-umamin-chat/components/chat/typing-indicator";
import { DmMessageBubble } from "./dm-message-bubble";

const HIGHLIGHT_MS = 1500;

type Props = {
  messages: UiDmMessage[];
  peerName: string;
  peerTyping: boolean;
  peerReadSeq: number;
  canInteract: boolean;
  hasMore: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  onReact: (messageId: string, emoji: string) => void;
  onReply: (message: UiDmMessage) => void;
  onUnsend: (messageId: string) => void;
  onReport: (messageId: string) => void;
  onRetry: (clientId: string) => void;
  empty?: React.ReactNode;
};

export function DmMessageList(props: Props) {
  return (
    <MessageScrollerProvider autoScroll defaultScrollPosition="end">
      <MessageScroller className="min-h-0 flex-1">
        <MessageScrollerViewport aria-label="Messages">
          <Thread {...props} />
        </MessageScrollerViewport>
        <MessageScrollerButton direction="end" />
      </MessageScroller>
    </MessageScrollerProvider>
  );
}

function Thread({
  messages,
  peerName,
  peerTyping,
  peerReadSeq,
  canInteract,
  hasMore,
  loadingOlder,
  onLoadOlder,
  onReact,
  onReply,
  onUnsend,
  onReport,
  onRetry,
  empty,
}: Props) {
  const { scrollToEnd, scrollToMessage } = useMessageScroller();
  const [highlightId, setHighlightId] = useState<string | null>(null);

  // Entrance animation for arrivals only, not for history present at mount.
  const initialIds = useRef<Set<string> | null>(null);
  if (initialIds.current === null) {
    initialIds.current = new Set(messages.map((m) => m.id));
  }

  // An own send lands in view even after scrolling up.
  const last = messages.at(-1);
  const ownSendId = last?.mine && last.delivery === "sending" ? last.id : null;
  useEffect(() => {
    if (ownSendId) scrollToEnd({ behavior: "smooth" });
  }, [ownSendId, scrollToEnd]);

  useEffect(() => {
    if (!highlightId) return;
    const t = setTimeout(() => setHighlightId(null), HIGHLIGHT_MS);
    return () => clearTimeout(t);
  }, [highlightId]);

  function jumpTo(messageId: string) {
    if (scrollToMessage(messageId, { align: "center", behavior: "smooth" })) {
      setHighlightId(messageId);
    }
  }

  const seenId = seenMessageId(messages, peerReadSeq);

  return (
    <MessageScrollerContent className="gap-0 px-3 pt-4 pb-3">
      {hasMore && (
        <div className="mb-4 flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            disabled={loadingOlder}
            onClick={onLoadOlder}
          >
            {loadingOlder ? "Loading…" : "Load older messages"}
          </Button>
        </div>
      )}
      {messages.length === 0 && empty}
      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const fresh = !initialIds.current?.has(m.id);
        return (
          <MessageScrollerItem
            key={m.id}
            messageId={m.id}
            className={cn(
              // The item is paint-contained (content-visibility), which clips
              // the focus ring and jump highlight a bubble draws outside its
              // box. 4px of padding cancelled by a negative margin gives them
              // room; the margins below are the old mt-1/mt-4 minus that 4px.
              "-mx-1 -mb-1 p-1",
              i === 0 ? "-mt-1" : prev?.mine === m.mine ? "mt-0" : "mt-3",
              fresh && "animate-chat-bubble-in motion-reduce:animate-none",
              m.mine ? "origin-bottom-right" : "origin-bottom-left",
            )}
          >
            <DmMessageBubble
              message={m}
              peerName={peerName}
              highlighted={m.id === highlightId}
              seen={m.id === seenId && m.id === last?.id}
              canInteract={canInteract}
              onReact={(emoji) => onReact(m.id, emoji)}
              onReply={() => onReply(m)}
              onUnsend={() => onUnsend(m.id)}
              onReport={() => onReport(m.id)}
              onJumpTo={jumpTo}
              onRetry={() => m.clientId && onRetry(m.clientId)}
            />
          </MessageScrollerItem>
        );
      })}
      {peerTyping && (
        <MessageScrollerItem
          className={cn(
            messages.length > 0 && (last && !last.mine ? "mt-1" : "mt-4"),
            "animate-chat-bubble-in origin-bottom-left motion-reduce:animate-none",
          )}
        >
          <Message>
            <TypingIndicator />
          </Message>
        </MessageScrollerItem>
      )}
    </MessageScrollerContent>
  );
}
