import { Message, MessageAvatar } from "@umamin/ui/components/message";
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
import { thinking } from "blobatar/expression";
import { type ReactNode, useEffect, useRef, useState } from "react";
import type { ChatMessage, PartnerStatus } from "@/lib/chat/types";
import { SeedAvatar } from "../seed-avatar";
import { MessageBubble } from "./message-bubble";
import type { Reactor } from "./reaction-details";
import { SystemMoment } from "./system-moment";
import { TypingIndicator } from "./typing-indicator";

const HIGHLIGHT_MS = 1500;
/** One-shot in-stream milestone. It drifts once the message window rolls past
 *  the cap, which is fine for an ephemeral novelty. */
const MILESTONE_AT = 50;

/** Centered rows (game results, burned whispers) break an author run. */
function isSystemRow(m: ChatMessage | undefined): boolean {
  return Boolean(m?.gameResult || m?.whisper?.state === "burned");
}

function sameRun(a: ChatMessage | undefined, b: ChatMessage | undefined) {
  return Boolean(
    a && b && !isSystemRow(a) && !isSystemRow(b) && a.author === b.author,
  );
}

type ListProps = {
  messages: ChatMessage[];
  partnerStatus: PartnerStatus | undefined;
  onReact: (messageId: string, emoji: string) => void;
  onReply: (message: ChatMessage) => void;
  onViewWhisper?: (messageId: string) => void;
  onRetry?: (messageId: string) => void;
  header?: ReactNode;
  self: Reactor;
  partner: Reactor;
  /** The live game round. It sits after the last message, inside the
   *  scroll content, so following the live edge keeps it and the latest
   *  messages in view as it grows. */
  dock?: ReactNode;
};

export function MessageList(props: ListProps) {
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
  partnerStatus,
  onReact,
  onReply,
  onViewWhisper,
  onRetry,
  header,
  self,
  partner,
  dock,
}: ListProps) {
  const { scrollToEnd, scrollToMessage } = useMessageScroller();
  const [highlightId, setHighlightId] = useState<string | null>(null);

  // Entrance animation for fresh arrivals only: what was present at mount is
  // history and renders static (lazy ref init; the set never mutates).
  const initialIds = useRef<Set<string> | null>(null);
  if (initialIds.current === null) {
    initialIds.current = new Set(messages.map((m) => m.id));
  }

  // The scroller follows the live edge while the reader is at the bottom. An
  // own send should land in view even after scrolling up, so it jumps.
  const last = messages[messages.length - 1];
  const ownSendId =
    last?.author === "self" && last.delivery === "sending" ? last.id : null;
  useEffect(() => {
    if (ownSendId) scrollToEnd({ behavior: "smooth" });
  }, [ownSendId, scrollToEnd]);

  useEffect(() => {
    if (!highlightId) return;
    const t = setTimeout(() => setHighlightId(null), HIGHLIGHT_MS);
    return () => clearTimeout(t);
  }, [highlightId]);

  // A target older than the message cap isn't rendered, so the jump is a
  // no-op rather than an error.
  function jumpTo(messageId: string) {
    if (scrollToMessage(messageId, { align: "center", behavior: "smooth" })) {
      setHighlightId(messageId);
    }
  }

  const typing = partnerStatus === "typing";

  return (
    <MessageScrollerContent className="gap-0 px-3 pt-4 pb-3">
      {header && <div className="mb-4">{header}</div>}
      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const next = messages[i + 1];
        const fresh =
          !initialIds.current?.has(m.id) &&
          (m.author === "partner" || m.delivery === "sending");
        // The avatar sits on the last partner bubble of a run, or moves down
        // to the typing bubble when that follows.
        const lastOfRun =
          !sameRun(m, next) && !(i === messages.length - 1 && typing);
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
              i === 0 ? "-mt-1" : sameRun(prev, m) ? "mt-0" : "mt-3",
              // Optimistic sends animate once: the acked message replaces the
              // bubble under a new id and must not pop in twice.
              fresh && "animate-chat-bubble-in motion-reduce:animate-none",
              m.author === "self"
                ? "origin-bottom-right"
                : "origin-bottom-left",
            )}
          >
            <MessageBubble
              message={m}
              onReact={(e) => onReact(m.id, e)}
              onReply={() => onReply(m)}
              onJumpTo={jumpTo}
              onViewWhisper={onViewWhisper}
              onRetry={onRetry && (() => onRetry(m.id))}
              highlighted={m.id === highlightId}
              showAvatar={lastOfRun}
              self={self}
              partner={partner}
            />
            {i === MILESTONE_AT - 1 && messages.length >= MILESTONE_AT && (
              <SystemMoment
                separator
                className="mt-4"
                animate={messages.length === MILESTONE_AT}
              >
                ✨ {MILESTONE_AT} messages deep
              </SystemMoment>
            )}
          </MessageScrollerItem>
        );
      })}
      {typing && (
        <MessageScrollerItem
          className={cn(
            messages.length > 0 &&
              (last?.author === "partner" && !isSystemRow(last)
                ? "mt-1"
                : "mt-4"),
            "animate-chat-bubble-in origin-bottom-left motion-reduce:animate-none",
          )}
        >
          <Message>
            <MessageAvatar className="bg-transparent">
              <SeedAvatar
                seed={partner.avatarSeed}
                alias={partner.alias}
                expression={thinking}
                className="size-8"
              />
            </MessageAvatar>
            <TypingIndicator />
          </Message>
        </MessageScrollerItem>
      )}
      {dock && <div className="mt-4">{dock}</div>}
    </MessageScrollerContent>
  );
}
