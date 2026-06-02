import { cn } from "@umamin/ui/lib/utils";
import { REACTION_EMOJIS } from "../../lib/mock/data";

export function ReactionPicker({
  onPick,
  placement = "top",
}: {
  onPick: (emoji: string) => void;
  placement?: "top" | "bottom";
}) {
  return (
    <div
      className={cn(
        "bg-popover absolute left-0 z-20 flex gap-0.5 rounded-full border px-1.5 py-1 shadow-lg",
        // Flip below the bubble when there's no room above (top messages would
        // otherwise be clipped under the chat header).
        placement === "top" ? "-top-9" : "top-full mt-1",
      )}
    >
      {REACTION_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          aria-label={`React ${emoji}`}
          className="hover:bg-accent focus-visible:border-ring focus-visible:ring-ring/50 rounded-full px-1 text-base leading-none transition-colors outline-none focus-visible:ring-[3px]"
          onClick={() => onPick(emoji)}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
