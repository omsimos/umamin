import {
  Bubble,
  BubbleContent,
  BubbleReactions,
} from "@umamin/ui/components/bubble";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
} from "@umamin/ui/components/message";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@umamin/ui/components/popover";
import { cn } from "@umamin/ui/lib/utils";
import { FlameIcon, ReplyIcon } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { WHISPER_BURN_MS } from "@/lib/chat/constants";
import { cardById, DECK_META } from "@/lib/chat/decks";
import type { ChatMessage, GameResult } from "@/lib/chat/types";
import { groupReactions } from "../../lib/reactions";
import { SeedAvatar } from "../seed-avatar";
import { ReactionDetails, type Reactor } from "./reaction-details";
import { ReactionPicker } from "./reaction-picker";
import { SystemMoment } from "./system-moment";

const bubbleShape = "rounded-2xl px-3.5 py-2 leading-relaxed";

function GameResultRow({
  result,
  partnerAlias,
}: {
  result: GameResult;
  partnerAlias: string;
}) {
  const card = cardById(result.cardId);
  if (!card) return null;
  const meta = DECK_META[card.deck];
  const matched = result.selfPick === result.partnerPick;
  const label = (pick: "A" | "B") =>
    pick === "A" ? card.optionA : card.optionB;
  // Guess rounds are asymmetric: the dealer's pick was the truth and the other
  // side's was a prediction of it, so the copy follows who read whom.
  const guess = result.mode === "guess";
  const iDealt = result.dealtBy === "self";
  const picksLine = guess
    ? iDealt
      ? `You: ${label(result.selfPick)} · ${partnerAlias} guessed: ${label(result.partnerPick)}`
      : `${partnerAlias}: ${label(result.partnerPick)} · You guessed: ${label(result.selfPick)}`
    : `You: ${label(result.selfPick)} · ${partnerAlias}: ${label(result.partnerPick)}`;
  const verdict = guess
    ? iDealt
      ? matched
        ? `🔮 ${partnerAlias} read your mind!`
        : `${partnerAlias} guessed wrong 😏`
      : matched
        ? "🔮 You read their mind!"
        : "Way off, full of surprises 😏"
    : matched
      ? "⚡ It's a match!"
      : "Opposites attract 🤷";

  return (
    <SystemMoment className="py-2">
      <span className="block font-medium">
        <span aria-hidden>{guess ? "🔮" : meta.emoji}</span>{" "}
        {guess ? "Mind Reader" : meta.label} · {card.optionA} vs {card.optionB}
      </span>
      <span className="mt-0.5 block">{picksLine}</span>
      <span className="text-foreground mt-0.5 block font-semibold">
        {verdict}
      </span>
    </SystemMoment>
  );
}

function WhisperCountdown({ viewedAt }: { viewedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  // The local clock only paints the countdown. The server's burn is what
  // redacts the message, so clock skew can't extend its life.
  const remaining = Math.max(
    0,
    Math.ceil((viewedAt + WHISPER_BURN_MS - now) / 1000),
  );
  return (
    <span className="flex items-center gap-1 tabular-nums">
      <FlameIcon aria-hidden className="size-3 text-orange-500" />
      burns in {remaining}s
    </span>
  );
}

/** Group chat's retry affordance, so a failed send reads the same in both. */
function RetryButton({ onRetry }: { onRetry?: () => void }) {
  return (
    <button
      type="button"
      onClick={onRetry}
      className="focus-visible:ring-ring/50 text-destructive rounded-sm outline-none focus-visible:ring-[3px]"
    >
      Not delivered · Tap to retry
    </button>
  );
}

/**
 * One message row. Game results and burned whispers render as centered
 * system rows; everything else is a Message with the partner's avatar on the
 * last bubble of a run.
 */
export function MessageBubble({
  message,
  onReact,
  onReply,
  onJumpTo,
  onViewWhisper,
  onRetry,
  highlighted = false,
  showAvatar = true,
  self,
  partner,
  vibeLevel = 1,
}: {
  message: ChatMessage;
  onReact: (emoji: string) => void;
  onReply: () => void;
  /** Re-send an own message whose delivery failed. */
  onRetry?: () => void;
  /** Scroll to the quoted message when its preview is tapped. */
  onJumpTo?: (messageId: string) => void;
  /** Reveal a received whisper (recipient only; starts its burn timer). */
  onViewWhisper?: (messageId: string) => void;
  /** Briefly true after this bubble is jumped to from a reply preview. */
  highlighted?: boolean;
  /** Partner rows: the avatar shows on the last bubble of a run only. */
  showAvatar?: boolean;
  self: Reactor;
  partner: Reactor;
  /** Gates which reaction emojis the picker offers. */
  vibeLevel?: number;
}) {
  const mine = message.author === "self";

  if (message.gameResult) {
    return (
      <GameResultRow result={message.gameResult} partnerAlias={partner.alias} />
    );
  }

  if (message.whisper?.state === "burned") {
    return (
      <SystemMoment separator>
        <FlameIcon
          aria-hidden
          className="mr-1 inline size-3 -translate-y-px text-orange-500"
        />
        Whisper burned
      </SystemMoment>
    );
  }

  return (
    <Message align={mine ? "end" : "start"}>
      {!mine && (
        // An empty slot keeps a run's bubbles aligned with the avatar row.
        <MessageAvatar className="bg-transparent group-has-data-[slot=message-footer]/message:-translate-y-5">
          {showAvatar && (
            <SeedAvatar
              seed={partner.avatarSeed}
              alias={partner.alias}
              className="size-8"
            />
          )}
        </MessageAvatar>
      )}
      <MessageContent className="gap-1">
        {message.whisper ? (
          <WhisperBody
            message={message}
            mine={mine}
            onViewWhisper={onViewWhisper}
            onRetry={onRetry}
          />
        ) : (
          <TextBody
            message={message}
            mine={mine}
            highlighted={highlighted}
            onReact={onReact}
            onReply={onReply}
            onJumpTo={onJumpTo}
            onRetry={onRetry}
            self={self}
            partner={partner}
            vibeLevel={vibeLevel}
          />
        )}
      </MessageContent>
    </Message>
  );
}

function WhisperBody({
  message,
  mine,
  onViewWhisper,
  onRetry,
}: {
  message: ChatMessage;
  mine: boolean;
  onViewWhisper?: (messageId: string) => void;
  onRetry?: () => void;
}) {
  const state = message.whisper?.state ?? "hidden";
  const delivery = mine ? message.delivery : undefined;

  if (state === "hidden" && !mine) {
    return (
      <Bubble variant="muted">
        <BubbleContent asChild className={bubbleShape}>
          <button
            type="button"
            onClick={() => onViewWhisper?.(message.id)}
            aria-label="Whisper received. Tap to reveal. It disappears about 10 seconds after reading."
            className="flex flex-col gap-0.5 transition-[filter] active:brightness-95"
          >
            <span
              aria-hidden
              className="text-foreground/50 tracking-widest blur-[3px] select-none"
            >
              ●●●●●●●●
            </span>
            <span className="text-muted-foreground flex items-center gap-1 text-xs">
              <FlameIcon aria-hidden className="size-3 text-orange-500" />
              Whisper · tap to reveal
            </span>
          </button>
        </BubbleContent>
      </Bubble>
    );
  }

  let footer: ReactNode = null;
  if (delivery === "failed") {
    footer = <RetryButton onRetry={onRetry} />;
  } else if (state === "revealed" && message.whisper?.viewedAt) {
    footer = <WhisperCountdown viewedAt={message.whisper.viewedAt} />;
  } else if (mine) {
    footer = (
      <span className="flex items-center gap-1">
        <FlameIcon aria-hidden className="size-3 text-orange-500" />
        Whisper · unseen
      </span>
    );
  }

  return (
    <>
      <Bubble variant={mine ? "default" : "muted"}>
        <BubbleContent
          className={cn(
            bubbleShape,
            "border-dashed border-orange-400/60",
            delivery && "opacity-70",
          )}
        >
          {message.text}
        </BubbleContent>
      </Bubble>
      {footer && (
        <MessageFooter className="px-1 font-normal">{footer}</MessageFooter>
      )}
    </>
  );
}

function TextBody({
  message,
  mine,
  highlighted,
  onReact,
  onReply,
  onJumpTo,
  onRetry,
  self,
  partner,
  vibeLevel,
}: {
  message: ChatMessage;
  mine: boolean;
  highlighted: boolean;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onJumpTo?: (messageId: string) => void;
  onRetry?: () => void;
  self: Reactor;
  partner: Reactor;
  vibeLevel: number;
}) {
  const [open, setOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const selfReaction = message.reactions.find((r) => r.by === "self")?.emoji;
  const groups = groupReactions(message.reactions);
  const replyTo = message.replyTo;
  // An undelivered send has no server id yet, so it can't be reacted or
  // replied to: it renders without the popover.
  const delivery = mine ? message.delivery : undefined;

  const quote = replyTo && (
    <button
      type="button"
      aria-label={`Go to replied-to message: ${replyTo.text}`}
      onClick={() => onJumpTo?.(replyTo.id)}
      className={cn(
        "bg-muted/60 text-muted-foreground focus-visible:ring-ring/50 flex max-w-full min-w-0 flex-col rounded-xl border-l-2 px-2.5 py-1.5 text-left text-xs outline-none focus-visible:ring-[3px]",
        mine ? "border-primary/60 self-end" : "border-foreground/20",
      )}
    >
      <span className="text-foreground/80 flex items-center gap-1 font-medium">
        <ReplyIcon aria-hidden className="size-3" />
        {replyTo.author === "self" ? "You" : partner.alias}
      </span>
      <span className="truncate">{replyTo.text}</span>
    </button>
  );

  return (
    <>
      <Bubble
        variant={mine ? "default" : "muted"}
        className={cn(groups.length > 0 && "mb-3.5")}
      >
        {quote}
        {delivery ? (
          <BubbleContent
            className={cn(
              bubbleShape,
              "transition-opacity",
              delivery === "sending" ? "opacity-70" : "opacity-60",
            )}
          >
            {message.text}
            {delivery === "sending" && (
              <span className="sr-only"> (sending)</span>
            )}
          </BubbleContent>
        ) : (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <BubbleContent asChild className={bubbleShape}>
                <button
                  type="button"
                  aria-label={`${mine ? "You" : "They"} said: ${message.text}. Tap to react or reply.`}
                  className={cn(
                    "transition-[filter,box-shadow] active:brightness-95",
                    highlighted && "ring-ring/60 ring-[3px]",
                  )}
                >
                  {message.text}
                </button>
              </BubbleContent>
            </PopoverTrigger>
            {/* Portaled and collision-aware, so the picker flips below a
                near-top bubble instead of hiding under the header. */}
            <PopoverContent
              side="top"
              align={mine ? "end" : "start"}
              sideOffset={8}
              collisionPadding={{ top: 72, bottom: 16, left: 12, right: 12 }}
              className="bg-popover/95 w-auto rounded-full border p-1 shadow-lg backdrop-blur"
            >
              <div className="flex items-center gap-0.5">
                <ReactionPicker
                  current={selfReaction}
                  vibeLevel={vibeLevel}
                  onPick={(emoji) => {
                    onReact(emoji);
                    setOpen(false);
                  }}
                />
                <div aria-hidden className="bg-border mx-0.5 h-6 w-px" />
                <button
                  type="button"
                  aria-label="Reply"
                  onClick={() => {
                    onReply();
                    setOpen(false);
                  }}
                  className="hover:bg-accent focus-visible:ring-ring/60 flex size-10 items-center justify-center rounded-full transition-transform outline-none focus-visible:ring-2 active:scale-90"
                >
                  <ReplyIcon className="size-5" />
                </button>
              </div>
            </PopoverContent>
          </Popover>
        )}
        {groups.length > 0 && (
          <BubbleReactions
            align={mine ? "start" : "end"}
            className="ring-background bg-muted"
          >
            <button
              type="button"
              aria-label="View reactions"
              onClick={() => setDetailsOpen(true)}
              // Keyed by the reaction signature, so a new or changed reaction
              // remounts the chip and it pops for both sides.
              key={groups.map((g) => `${g.emoji}${g.count}`).join("|")}
              className="animate-chat-pop-in focus-visible:ring-ring/50 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-sm leading-none outline-none focus-visible:ring-[3px] active:scale-95 motion-reduce:animate-none"
            >
              {groups.map((group) => (
                <span key={group.emoji} className="flex items-center gap-0.5">
                  {group.emoji}
                  {group.count > 1 && (
                    <span className="text-muted-foreground text-xs font-medium tabular-nums">
                      {group.count}
                    </span>
                  )}
                </span>
              ))}
            </button>
          </BubbleReactions>
        )}
      </Bubble>
      {groups.length > 0 && (
        <ReactionDetails
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          reactions={message.reactions}
          self={self}
          partner={partner}
        />
      )}
      {delivery === "failed" && (
        <MessageFooter className="px-1 font-normal">
          <RetryButton onRetry={onRetry} />
        </MessageFooter>
      )}
    </>
  );
}
