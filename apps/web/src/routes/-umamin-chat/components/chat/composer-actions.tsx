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
import { DECK_META, DECK_ORDER, type PlayChoice } from "@/lib/chat/decks";
import type { SendEffect } from "@/lib/chat/types";
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

const PLAYS: { id: PlayChoice; emoji: string; label: string; hint: string }[] =
  [
    ...DECK_ORDER.map((id) => ({ id, ...DECK_META[id] })),
    {
      id: "mind-reader",
      emoji: "🔮",
      label: "Mind Reader",
      hint: "Guess their answer",
    },
  ];

const sectionLabel = "text-muted-foreground px-1 text-xs font-medium";

function ActionsBody({
  mode,
  onChoose,
  onPlay,
}: {
  mode: ComposerMode;
  onChoose: (next: ComposerMode) => void;
  /** Absent = games hidden (mirrors the route not wiring games). */
  onPlay?: (choice: PlayChoice) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {onPlay && (
        <div className="flex flex-col gap-1.5">
          <p className={sectionLabel}>Play together</p>
          <div className="grid grid-cols-2 gap-1.5">
            {PLAYS.map((play) => (
              <button
                key={play.id}
                type="button"
                onClick={() => onPlay(play.id)}
                className={cn(
                  "hover:border-primary/50 flex min-h-12 items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-sm",
                  "focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
                  "transition-transform active:scale-95",
                )}
              >
                <span aria-hidden className="text-base leading-none">
                  {play.emoji}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{play.label}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {play.hint}
                  </span>
                </span>
              </button>
            ))}
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
              Disappears after they read it
            </span>
          </span>
        </button>
      </div>
      <div className="flex flex-col gap-1.5">
        <p className={sectionLabel}>Send with</p>
        <div className="flex items-center gap-1.5">
          {EFFECTS.map((e) => {
            const on = mode.effect === e.id;
            return (
              <button
                key={e.id}
                type="button"
                aria-pressed={on}
                aria-label={`Send with ${e.label}`}
                onClick={() =>
                  onChoose(on ? IDLE_MODE : { whisper: false, effect: e.id })
                }
                className={cn(
                  "hover:border-primary/50 flex size-11 items-center justify-center rounded-full border text-lg leading-none",
                  "focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
                  "transition-transform active:scale-90",
                  on && "border-primary bg-primary/10",
                )}
              >
                <span aria-hidden>{e.emoji}</span>
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
  onPlay,
}: {
  mode: ComposerMode;
  onModeChange: (mode: ComposerMode) => void;
  /** Start a round. Absent = games hidden. */
  onPlay?: (choice: PlayChoice) => void;
}) {
  const [open, setOpen] = useState(false);
  // Bottom sheet below lg (the grid outgrew a popover), popover where space
  // isn't scarce.
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  function trigger(onClick?: () => void) {
    return (
      <button
        type="button"
        aria-label="Message options"
        onClick={onClick}
        className={cn(
          "hover:bg-accent bg-muted/40 text-muted-foreground hover:text-foreground flex size-12 shrink-0 items-center justify-center rounded-full border",
          "focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
          "transition-[color,background-color,transform] active:scale-90",
          (mode.whisper || mode.effect) && "border-primary text-primary",
        )}
      >
        <Plus
          className={cn("size-5 transition-transform", open && "rotate-45")}
        />
      </button>
    );
  }

  const body = (
    <ActionsBody
      mode={mode}
      onChoose={(next) => {
        onModeChange(next);
        setOpen(false);
      }}
      onPlay={
        onPlay
          ? (choice) => {
              onPlay(choice);
              setOpen(false);
            }
          : undefined
      }
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
