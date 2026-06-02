import { REACTION_EMOJIS } from "../../lib/mock/data";

export function ReactionPicker({
  onPick,
}: {
  onPick: (emoji: string) => void;
}) {
  return (
    <div className="bg-popover absolute -top-9 left-0 z-10 flex gap-0.5 rounded-full border px-1.5 py-1 shadow-lg">
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
