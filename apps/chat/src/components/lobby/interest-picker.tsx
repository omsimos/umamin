import { cn } from "@umamin/ui/lib/utils";
import { INTERESTS } from "../../lib/content";

export function InterestPicker({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {INTERESTS.map((interest) => {
        const on = selected.includes(interest.id);
        return (
          <button
            key={interest.id}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(interest.id)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm transition-[color,background-color,border-color,transform] active:scale-95",
              "focus-visible:border-ring focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
              on
                ? "bg-primary text-primary-foreground border-primary font-medium"
                : "bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {/* Keyed by state so selecting pops the content without
                remounting the button (focus stays put). */}
            <span
              key={String(on)}
              className={cn(
                "inline-block",
                on && "animate-pop-in motion-reduce:animate-none",
              )}
            >
              <span aria-hidden>{interest.emoji}</span> {interest.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
