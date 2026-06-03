import { REACTION_EMOJIS } from "../../lib/content";

export function ReactionPicker({
  onPick,
}: {
  onPick: (emoji: string) => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {REACTION_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          aria-label={`React ${emoji}`}
          className="hover:bg-accent focus-visible:ring-ring/60 flex size-10 items-center justify-center rounded-full text-xl leading-none transition-transform outline-none focus-visible:ring-2 active:scale-90"
          onClick={() => onPick(emoji)}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
