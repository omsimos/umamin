import { cn } from "@umamin/ui/lib/utils";
import { type ReactNode, useEffect, useRef, useState } from "react";
import type { ChatMessage, PartnerStatus } from "../../lib/session/types";
import { MessageBubble } from "./message-bubble";
import type { Reactor } from "./reaction-details";
import { SystemMoment } from "./system-moment";
import { TypingIndicator } from "./typing-indicator";

const HIGHLIGHT_MS = 1500;
/** One-shot in-stream milestone; drifts once the message window rolls past
 *  the cap — acceptable for an ephemeral novelty. */
const MILESTONE_AT = 50;

export function MessageList({
  messages,
  partnerStatus,
  onReact,
  onReply,
  onViewWhisper,
  header,
  self,
  partner,
  vibeLevel,
}: {
  messages: ChatMessage[];
  partnerStatus: PartnerStatus | undefined;
  onReact: (messageId: string, emoji: string) => void;
  onReply: (message: ChatMessage) => void;
  onViewWhisper?: (messageId: string) => void;
  header?: ReactNode;
  self: Reactor;
  partner: Reactor;
  /** Gates which reaction emojis the picker offers. */
  vibeLevel?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const didInitialScroll = useRef(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  // Entrance animation for fresh arrivals only: whatever was present at mount
  // is history and renders static (lazy ref init — the set never mutates).
  const initialIds = useRef<Set<string> | null>(null);
  if (initialIds.current === null) {
    initialIds.current = new Set(messages.map((m) => m.id));
  }

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

  useEffect(() => {
    if (!highlightId) return;
    const t = setTimeout(() => setHighlightId(null), HIGHLIGHT_MS);
    return () => clearTimeout(t);
  }, [highlightId]);

  // Same scroll-the-container rule as above. A target older than the message
  // cap isn't rendered, so the jump is a no-op rather than an error.
  function jumpTo(messageId: string) {
    const c = containerRef.current;
    if (!c) return;
    const el = c.querySelector<HTMLElement>(
      `[data-message-id="${CSS.escape(messageId)}"]`,
    );
    if (!el) return;
    const top =
      el.getBoundingClientRect().top -
      c.getBoundingClientRect().top +
      c.scrollTop -
      72;
    if (typeof c.scrollTo === "function") {
      c.scrollTo({ top, behavior: "smooth" });
    } else {
      c.scrollTop = top;
    }
    setHighlightId(messageId);
  }

  return (
    <div
      ref={containerRef}
      className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-4"
    >
      {header}
      {messages.map((m, i) => (
        <div
          key={m.id}
          data-message-id={m.id}
          className={cn(
            !initialIds.current?.has(m.id) &&
              "animate-bubble-in motion-reduce:animate-none",
            m.author === "self" ? "origin-bottom-right" : "origin-bottom-left",
          )}
        >
          <MessageBubble
            message={m}
            onReact={(e) => onReact(m.id, e)}
            onReply={() => onReply(m)}
            onJumpTo={jumpTo}
            onViewWhisper={onViewWhisper}
            highlighted={m.id === highlightId}
            self={self}
            partner={partner}
            vibeLevel={vibeLevel}
          />
          {i === MILESTONE_AT - 1 && messages.length >= MILESTONE_AT && (
            <div className="pt-2.5">
              <SystemMoment animate={messages.length === MILESTONE_AT}>
                <p className="text-foreground font-semibold">
                  ✨ {MILESTONE_AT} messages deep ✨
                </p>
                <p className="mt-0.5">you two have a lot to say</p>
              </SystemMoment>
            </div>
          )}
        </div>
      ))}
      {partnerStatus === "typing" && <TypingIndicator />}
    </div>
  );
}
