import { cn } from "@umamin/ui/lib/utils";
import { REACTION_EMOJIS } from "../../lib/content";

export function ReactionPicker({
  onPick,
  placement = "top",
  autoFocusFirst = false,
}: {
  onPick: (emoji: string) => void;
  placement?: "top" | "bottom";
  autoFocusFirst?: boolean;
}) {
  return (
    <div
      className={cn(
        "bg-popover absolute left-0 z-20 flex gap-0.5 rounded-full border px-1.5 py-1 shadow-lg",
        // Flip below the bubble when there's no room above, else it's clipped under the chat header.
        placement === "top" ? "-top-9" : "top-full mt-1",
      )}
    >
      {REACTION_EMOJIS.map((emoji, i) => (
        <button
          key={emoji}
          type="button"
          // biome-ignore lint/a11y/noAutofocus: focus moves into the popup on open
          autoFocus={autoFocusFirst && i === 0}
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
