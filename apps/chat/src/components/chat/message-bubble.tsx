import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@umamin/ui/components/popover";
import { cn } from "@umamin/ui/lib/utils";
import { Flame, Reply } from "lucide-react";
import { useEffect, useState } from "react";
import { WHISPER_BURN_MS } from "../../../convex/constants";
import { cardById, DECK_META } from "../../../convex/decks";
import { groupReactions } from "../../lib/reactions";
import type { ChatMessage, GameResult } from "../../lib/session/types";
import { ReactionDetails, type Reactor } from "./reaction-details";
import { ReactionPicker } from "./reaction-picker";
import { SystemMoment } from "./system-moment";

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
  // Guess rounds are asymmetric: the dealer's pick was the truth, the other
  // side's a prediction of it — the copy follows who read whom.
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
        : "Way off — full of surprises 😏"
    : matched
      ? "⚡ It's a match!"
      : "Opposites attract 🤷";

  return (
    <SystemMoment>
      <p className="font-medium">
        <span aria-hidden>{guess ? "🔮" : meta.emoji}</span>{" "}
        {guess ? "Mind Reader" : meta.label} · {card.optionA} vs {card.optionB}
      </p>
      <p className="mt-0.5">{picksLine}</p>
      <p className="text-foreground mt-0.5 font-semibold">{verdict}</p>
    </SystemMoment>
  );
}

function WhisperCountdown({ viewedAt }: { viewedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  // Local clock only paints the countdown — the server's burn is what
  // actually redacts the message, so skew can't extend its life.
  const remaining = Math.max(
    0,
    Math.ceil((viewedAt + WHISPER_BURN_MS - now) / 1000),
  );
  return (
    <span className="text-muted-foreground flex items-center gap-1 text-[11px] tabular-nums">
      <Flame aria-hidden className="size-3 text-orange-500" />
      burns in {remaining}s
    </span>
  );
}

function WhisperBubble({
  message,
  onViewWhisper,
}: {
  message: ChatMessage;
  onViewWhisper: (messageId: string) => void;
}) {
  const mine = message.author === "self";
  const state = message.whisper?.state ?? "hidden";

  if (state === "burned") {
    return (
      <div
        className={cn("flex w-full", mine ? "justify-end" : "justify-start")}
      >
        <div className="bg-muted/40 text-muted-foreground max-w-[78%] rounded-2xl border border-dashed px-3.5 py-2 text-sm italic">
          🔥 Whisper burned
        </div>
      </div>
    );
  }

  if (state === "hidden" && !mine) {
    return (
      <div className="flex w-full justify-start">
        <button
          type="button"
          onClick={() => onViewWhisper(message.id)}
          aria-label="Whisper received. Tap to reveal — it disappears about 10 seconds after reading."
          className={cn(
            "bg-muted flex max-w-[78%] flex-col gap-0.5 rounded-2xl rounded-bl-sm px-3.5 py-2 text-left",
            "focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
            "transition-[filter] active:brightness-95",
          )}
        >
          <span
            aria-hidden
            className="text-foreground/60 text-sm tracking-widest blur-[3px] select-none"
          >
            ●●●●●●
          </span>
          <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
            <Flame aria-hidden className="size-3 text-orange-500" />
            Whisper — tap to reveal
          </span>
        </button>
      </div>
    );
  }

  // Sender's own whisper (any pre-burn state) or a revealed one for either side.
  return (
    <div
      className={cn(
        "flex w-full flex-col gap-1",
        mine ? "items-end" : "items-start",
      )}
    >
      <div
        className={cn(
          "max-w-[78%] rounded-2xl border border-dashed border-orange-500/40 px-3.5 py-2 text-sm leading-relaxed break-words",
          mine
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-muted text-foreground rounded-bl-sm",
        )}
      >
        {message.text}
      </div>
      {state === "revealed" && message.whisper?.viewedAt ? (
        <WhisperCountdown viewedAt={message.whisper.viewedAt} />
      ) : (
        mine && (
          <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
            <Flame aria-hidden className="size-3 text-orange-500" />
            Whisper · unseen
          </span>
        )
      )}
    </div>
  );
}

function replyLabel(
  mine: boolean,
  targetAuthor: "self" | "partner",
  partnerAlias: string,
): string {
  if (mine) {
    return targetAuthor === "self"
      ? "You replied to yourself"
      : `You replied to ${partnerAlias}`;
  }
  return targetAuthor === "self"
    ? `${partnerAlias} replied to you`
    : `${partnerAlias} replied to themself`;
}

export function MessageBubble({
  message,
  onReact,
  onReply,
  onJumpTo,
  onViewWhisper,
  highlighted = false,
  self,
  partner,
  vibeLevel = 1,
}: {
  message: ChatMessage;
  onReact: (emoji: string) => void;
  onReply: () => void;
  /** Scroll to the quoted message when its preview is tapped. */
  onJumpTo?: (messageId: string) => void;
  /** Reveal a received whisper (recipient-only; starts its burn timer). */
  onViewWhisper?: (messageId: string) => void;
  /** Briefly true after this bubble is jumped to via a reply preview. */
  highlighted?: boolean;
  self: Reactor;
  partner: Reactor;
  /** Gates which reaction emojis the picker offers. */
  vibeLevel?: number;
}) {
  const [open, setOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const mine = message.author === "self";
  const selfReaction = message.reactions.find((r) => r.by === "self")?.emoji;
  const groups = groupReactions(message.reactions);
  const replyTo = message.replyTo;

  // Completed game rounds render as a centered system-style record — no
  // author side, no react/reply popover.
  if (message.gameResult) {
    return (
      <GameResultRow result={message.gameResult} partnerAlias={partner.alias} />
    );
  }

  // Whispers are ephemeral: no react/reply popover, no reaction badges — the
  // bubble itself is the reveal trigger for the recipient.
  if (message.whisper) {
    return (
      <WhisperBubble
        message={message}
        onViewWhisper={onViewWhisper ?? (() => {})}
      />
    );
  }

  return (
    <div
      className={cn("flex w-full flex-col", mine ? "items-end" : "items-start")}
    >
      {replyTo && (
        <>
          <span
            className={cn(
              "text-muted-foreground mb-0.5 flex items-center gap-1 px-3 text-[11px]",
              mine ? "flex-row-reverse" : "",
            )}
          >
            <Reply aria-hidden className="size-3" />
            {replyLabel(mine, replyTo.author, partner.alias)}
          </span>
          <button
            type="button"
            aria-label={`Go to replied-to message: ${replyTo.text}`}
            onClick={() => onJumpTo?.(replyTo.id)}
            className={cn(
              "bg-muted/60 text-muted-foreground -mb-2.5 max-w-[70%] truncate rounded-2xl px-3.5 pt-1.5 pb-4 text-left text-xs",
              "focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
              mine ? "mr-1" : "ml-1",
            )}
          >
            {replyTo.text}
          </button>
        </>
      )}
      <div className="relative max-w-[78%]">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`${mine ? "You" : "They"} said: ${message.text}. Tap to react or reply.`}
              className={cn(
                "rounded-2xl px-3.5 py-2 text-left text-sm leading-relaxed break-words",
                "focus-visible:border-ring focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
                "transition-[filter,box-shadow] active:brightness-95",
                mine
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-muted text-foreground rounded-bl-sm",
                highlighted && "ring-ring/60 ring-[3px]",
              )}
            >
              {message.text}
            </button>
          </PopoverTrigger>
          {/* Portaled + viewport collision-aware, so the picker flips below the
              bubble near the top instead of being clipped under the header. */}
          <PopoverContent
            side="top"
            align={mine ? "end" : "start"}
            sideOffset={8}
            // Clear the stacked top chrome (app header + chat header) so a
            // near-top message flips the picker below instead of over them.
            collisionPadding={{ top: 116, bottom: 16, left: 12, right: 12 }}
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
                <Reply className="size-5" />
              </button>
            </div>
          </PopoverContent>
        </Popover>
        {groups.length > 0 && (
          <>
            <button
              type="button"
              aria-label="View reactions"
              onClick={() => setDetailsOpen(true)}
              // Keyed by the reaction signature: a new/changed reaction
              // remounts the chip so it pings (pop-in) for both sides.
              key={groups.map((g) => `${g.emoji}${g.count}`).join("|")}
              className={cn(
                "bg-popover absolute -bottom-3 flex items-center gap-1 rounded-full border px-2 py-0.5 text-base leading-none shadow-sm",
                "focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
                "animate-pop-in motion-reduce:animate-none transition-transform active:scale-95",
                mine ? "left-2" : "right-2",
              )}
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
            <ReactionDetails
              open={detailsOpen}
              onOpenChange={setDetailsOpen}
              reactions={message.reactions}
              self={self}
              partner={partner}
            />
          </>
        )}
      </div>
    </div>
  );
}
