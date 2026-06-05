import { cn } from "@umamin/ui/lib/utils";
import { REACTION_EMOJIS } from "../../lib/content";

export function ReactionPicker({
  onPick,
  current,
}: {
  onPick: (emoji: string) => void;
  /** The user's existing reaction, highlighted — picking it again removes it. */
  current?: string;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {REACTION_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          aria-label={`React ${emoji}`}
          aria-pressed={emoji === current}
          className={cn(
            "hover:bg-accent focus-visible:ring-ring/60 flex size-10 items-center justify-center rounded-full text-xl leading-none transition-transform outline-none focus-visible:ring-2 active:scale-90",
            emoji === current && "bg-accent",
          )}
          onClick={() => onPick(emoji)}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
