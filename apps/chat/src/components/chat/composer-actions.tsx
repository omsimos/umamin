import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@umamin/ui/components/drawer";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@umamin/ui/components/popover";
import { cn } from "@umamin/ui/lib/utils";
import { Flame, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EFFECT_MIN_LEVEL } from "../../../convex/constants";
import {
  DECK_META,
  DECK_MIN_LEVEL,
  type DeckId,
  GAME_DECKS,
  GUESS_MODE_MIN_LEVEL,
} from "../../../convex/decks";
import type { GameMode, SendEffect } from "../../lib/session/types";
import { useMediaQuery } from "../../lib/use-media-query";

/** What the next send will be — whisper and effect are mutually exclusive. */
export interface ComposerMode {
  whisper: boolean;
  effect?: SendEffect;
}

export const IDLE_MODE: ComposerMode = { whisper: false };

const EFFECTS: { id: SendEffect; emoji: string; label: string }[] = [
  { id: "confetti", emoji: "🎉", label: "confetti" },
  { id: "hearts", emoji: "💖", label: "hearts" },
  { id: "sparkles", emoji: "✨", label: "sparkles" },
  { id: "poof", emoji: "💨", label: "poof" },
  { id: "golden", emoji: "👑", label: "golden hearts" },
];

const DECKS: DeckId[] = [
  "this-or-that",
  "would-you-rather",
  "hot-takes",
  "never-have-i-ever",
];

const sectionLabel =
  "text-muted-foreground px-1 text-[10px] font-semibold tracking-wider uppercase";

function lockedToast(level: number, onShowVibe?: () => void) {
  toast(`Unlocks at Vibe Level ${level} — keep the chat flowing`, {
    ...(onShowVibe
      ? { action: { label: "See vibe", onClick: onShowVibe } }
      : {}),
  });
}

function LockChip({ level }: { level: number }) {
  return (
    <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[9px] font-semibold">
      <span aria-hidden>🔒</span> L{level}
    </span>
  );
}

function PlayTile({
  emoji,
  label,
  hint,
  minLevel,
  vibeLevel,
  onPlay,
  onShowVibe,
}: {
  emoji: string;
  label: string;
  hint: string;
  minLevel: number;
  vibeLevel: number;
  onPlay: () => void;
  onShowVibe?: () => void;
}) {
  const locked = minLevel > vibeLevel;
  return (
    // Locked tiles stay real buttons (not disabled) so the explainer toast is
    // reachable by touch, keyboard, and screen readers alike.
    <button
      type="button"
      aria-label={
        locked ? `${label} — unlocks at vibe level ${minLevel}` : label
      }
      onClick={() => (locked ? lockedToast(minLevel, onShowVibe) : onPlay())}
      className={cn(
        "flex min-h-12 items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-sm",
        "focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
        "transition-transform active:scale-95",
        locked ? "opacity-60" : "hover:border-primary/50",
      )}
    >
      <span aria-hidden className="text-base leading-none">
        {emoji}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="flex items-center gap-1.5 font-medium">
          <span className="truncate">{label}</span>
          {locked && <LockChip level={minLevel} />}
        </span>
        <span className="text-muted-foreground text-xs">{hint}</span>
      </span>
    </button>
  );
}

function ActionsBody({
  mode,
  vibeLevel,
  onChoose,
  onDeal,
  onShowVibe,
}: {
  mode: ComposerMode;
  vibeLevel: number;
  onChoose: (next: ComposerMode) => void;
  /** Absent = games hidden (mirrors the route not wiring dealCard). */
  onDeal?: (cardId: string, gameMode?: GameMode) => void;
  onShowVibe?: () => void;
}) {
  function dealFrom(deck: DeckId) {
    const cards = GAME_DECKS[deck];
    onDeal?.(cards[Math.floor(Math.random() * cards.length)].id);
  }

  function dealGuess() {
    const pool = DECKS.filter((d) => DECK_MIN_LEVEL[d] <= vibeLevel).flatMap(
      (d) => GAME_DECKS[d],
    );
    onDeal?.(pool[Math.floor(Math.random() * pool.length)].id, "guess");
  }

  return (
    <div className="flex flex-col gap-3">
      {onDeal && (
        <div className="flex flex-col gap-1.5">
          <p className={sectionLabel}>Play together</p>
          <div className="grid grid-cols-2 gap-1.5">
            {DECKS.map((deck) => (
              <PlayTile
                key={deck}
                emoji={DECK_META[deck].emoji}
                label={DECK_META[deck].label}
                hint="play a quick round"
                minLevel={DECK_MIN_LEVEL[deck]}
                vibeLevel={vibeLevel}
                onPlay={() => dealFrom(deck)}
                onShowVibe={onShowVibe}
              />
            ))}
            <PlayTile
              emoji="🔮"
              label="Mind Reader"
              hint="guess their pick"
              minLevel={GUESS_MODE_MIN_LEVEL}
              vibeLevel={vibeLevel}
              onPlay={dealGuess}
              onShowVibe={onShowVibe}
            />
          </div>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <p className={sectionLabel}>Next message</p>
        <button
          type="button"
          aria-pressed={mode.whisper}
          onClick={() => onChoose(mode.whisper ? IDLE_MODE : { whisper: true })}
          className={cn(
            "hover:bg-accent flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-sm",
            "focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
            mode.whisper && "border-orange-500/50 bg-accent",
          )}
        >
          <Flame className="size-4 text-orange-500" />
          <span className="flex flex-col">
            <span className="font-medium">Whisper</span>
            <span className="text-muted-foreground text-xs">
              disappears after reading
            </span>
          </span>
        </button>
      </div>
      <div className="flex flex-col gap-1.5">
        <p className={sectionLabel}>Send with</p>
        <div className="flex items-center gap-1.5">
          {EFFECTS.map((e) => {
            const minLevel = EFFECT_MIN_LEVEL[e.id] ?? 1;
            const locked = minLevel > vibeLevel;
            const on = mode.effect === e.id;
            return (
              <button
                key={e.id}
                type="button"
                aria-pressed={on}
                aria-label={
                  locked
                    ? `Send with ${e.label} — unlocks at vibe level ${minLevel}`
                    : `Send with ${e.label}`
                }
                onClick={() => {
                  if (locked) {
                    lockedToast(minLevel, onShowVibe);
                    return;
                  }
                  onChoose(on ? IDLE_MODE : { whisper: false, effect: e.id });
                }}
                className={cn(
                  "relative flex size-11 items-center justify-center rounded-full border text-lg leading-none",
                  "focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
                  "transition-transform active:scale-90",
                  on && "border-primary bg-primary/10",
                  locked ? "opacity-50" : "hover:border-primary/50",
                )}
              >
                <span aria-hidden>{e.emoji}</span>
                {locked && (
                  <span
                    aria-hidden
                    className="bg-muted absolute -right-1 -bottom-1 rounded-full px-1 text-[9px]"
                  >
                    🔒
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function ComposerActions({
  mode,
  onModeChange,
  onDealCard,
  vibeLevel = 1,
  onShowVibe,
}: {
  mode: ComposerMode;
  onModeChange: (mode: ComposerMode) => void;
  /** Deal a random card (optionally in guess mode). Absent = games hidden. */
  onDealCard?: (cardId: string, gameMode?: GameMode) => void;
  /** Gates locked tiles; the server re-enforces every gate. */
  vibeLevel?: number;
  onShowVibe?: () => void;
}) {
  const [open, setOpen] = useState(false);
  // Same breakpoint as the shell's rail/drawer split (lg): bottom sheet on
  // mobile (the grid outgrew a popover), popover where space isn't scarce.
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  function trigger(onClick?: () => void) {
    return (
      <button
        type="button"
        aria-label="Message options"
        onClick={onClick}
        className={cn(
          "hover:bg-accent flex size-9 shrink-0 items-center justify-center rounded-full border",
          "focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
          "transition-transform active:scale-90",
          (mode.whisper || mode.effect) && "border-primary text-primary",
        )}
      >
        <Plus
          className={cn("size-4 transition-transform", open && "rotate-45")}
        />
      </button>
    );
  }

  const body = (
    <ActionsBody
      mode={mode}
      vibeLevel={vibeLevel}
      onChoose={(next) => {
        onModeChange(next);
        setOpen(false);
      }}
      onDeal={
        onDealCard
          ? (cardId, gameMode) => {
              onDealCard(cardId, gameMode);
              setOpen(false);
            }
          : undefined
      }
      onShowVibe={onShowVibe}
    />
  );

  if (isDesktop) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{trigger()}</PopoverTrigger>
        <PopoverContent
          side="top"
          align="start"
          sideOffset={8}
          className="w-80 rounded-xl p-3"
        >
          {body}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <>
      {trigger(() => setOpen(true))}
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Make it fun</DrawerTitle>
            <DrawerDescription className="sr-only">
              Games, whispers and send effects for this chat
            </DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-6">{body}</div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
