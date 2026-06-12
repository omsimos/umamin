import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@umamin/ui/components/popover";
import { cn } from "@umamin/ui/lib/utils";
import { Flame, Plus } from "lucide-react";
import { useState } from "react";
import { DECK_META, type DeckId, GAME_DECKS } from "../../../convex/decks";
import type { SendEffect } from "../../lib/session/types";

/** What the next send will be — whisper and effect are mutually exclusive. */
export interface ComposerMode {
  whisper: boolean;
  effect?: SendEffect;
}

export const IDLE_MODE: ComposerMode = { whisper: false };

const EFFECTS: { id: SendEffect; emoji: string; label: string }[] = [
  { id: "confetti", emoji: "🎉", label: "Send with confetti" },
  { id: "hearts", emoji: "💖", label: "Send with hearts" },
];

const rowClass = cn(
  "hover:bg-accent flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm",
  "focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
);

const DECKS: DeckId[] = ["this-or-that", "would-you-rather"];

export function ComposerActions({
  mode,
  onModeChange,
  onDealCard,
}: {
  mode: ComposerMode;
  onModeChange: (mode: ComposerMode) => void;
  /** Deal a random card from the chosen deck. Absent = games hidden. */
  onDealCard?: (cardId: string) => void;
}) {
  const [open, setOpen] = useState(false);

  function choose(next: ComposerMode) {
    onModeChange(next);
    setOpen(false);
  }

  function deal(deck: DeckId) {
    const cards = GAME_DECKS[deck];
    onDealCard?.(cards[Math.floor(Math.random() * cards.length)].id);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Message options"
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
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-56 rounded-xl p-1.5"
      >
        {onDealCard && (
          <>
            {DECKS.map((deck) => (
              <button
                key={deck}
                type="button"
                onClick={() => deal(deck)}
                className={rowClass}
              >
                <span className="text-base leading-none">
                  {DECK_META[deck].emoji}
                </span>
                <span className="flex flex-col">
                  {DECK_META[deck].label}
                  <span className="text-muted-foreground text-xs">
                    play a quick round
                  </span>
                </span>
              </button>
            ))}
            <div aria-hidden className="bg-border my-1 h-px" />
          </>
        )}
        <button
          type="button"
          aria-pressed={mode.whisper}
          onClick={() => choose(mode.whisper ? IDLE_MODE : { whisper: true })}
          className={cn(rowClass, mode.whisper && "bg-accent")}
        >
          <Flame className="size-4 text-orange-500" />
          <span className="flex flex-col">
            Whisper
            <span className="text-muted-foreground text-xs">
              disappears after reading
            </span>
          </span>
        </button>
        {EFFECTS.map((e) => {
          const on = mode.effect === e.id;
          return (
            <button
              key={e.id}
              type="button"
              aria-pressed={on}
              onClick={() =>
                choose(on ? IDLE_MODE : { whisper: false, effect: e.id })
              }
              className={cn(rowClass, on && "bg-accent")}
            >
              <span className="text-base leading-none">{e.emoji}</span>
              {e.label}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
