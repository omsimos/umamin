import { cn } from "@umamin/ui/lib/utils";
import { INTERESTS } from "../../lib/mock/data";

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
              "rounded-full border px-3 py-1.5 text-sm transition-colors",
              "focus-visible:border-ring focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
              on
                ? "bg-primary text-primary-foreground border-primary font-medium"
                : "bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            <span aria-hidden>{interest.emoji}</span> {interest.label}
          </button>
        );
      })}
    </div>
  );
}
