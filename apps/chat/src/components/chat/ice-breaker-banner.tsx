import { Button } from "@umamin/ui/components/button";
import { MessageSquareQuoteIcon, XIcon } from "lucide-react";
import { ICE_BREAKER_PROMPTS, interestById } from "../../lib/content";

export function IceBreakerBanner({
  sharedInterests,
  onPrompt,
  onDismiss,
}: {
  sharedInterests: string[];
  onPrompt: (text: string) => void;
  onDismiss: () => void;
}) {
  const labels = sharedInterests
    .map((id) => interestById(id)?.label)
    .filter(Boolean)
    .join(" & ");

  return (
    <div className="border-primary/30 from-primary/10 relative rounded-xl border bg-gradient-to-b to-transparent p-3">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Dismiss ice-breaker"
        className="text-muted-foreground absolute top-1 right-1 size-7"
        onClick={onDismiss}
      >
        <XIcon />
      </Button>
      <p className="text-primary mb-2 flex items-center gap-1.5 text-xs font-semibold">
        <MessageSquareQuoteIcon className="size-3.5" />
        {labels ? `You both like ${labels}` : "Say hi 👋"}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {ICE_BREAKER_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onPrompt(prompt)}
            className="border-primary/30 bg-primary/5 text-foreground hover:bg-primary/15 rounded-full border px-2.5 py-1 text-xs transition-colors"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
