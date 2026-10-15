import { Button } from "@umamin/ui/components/button";
import { XIcon } from "lucide-react";
import { ICE_BREAKER_PROMPTS, interestById } from "@/lib/chat/content";
import { SystemMoment } from "./system-moment";

const chip =
  "bg-background hover:bg-muted h-8 rounded-full px-3 text-xs font-normal";

export function IceBreakerBanner({
  sharedInterests,
  extraPrompt,
  onPrompt,
  onDismiss,
}: {
  sharedInterests: string[];
  /** The radar warm-up's last pick: wait time turned into an opener. */
  extraPrompt?: string | null;
  onPrompt: (text: string) => void;
  onDismiss: () => void;
}) {
  const shared = sharedInterests
    .map((id) => interestById(id))
    .filter((i) => i !== undefined);
  const prompts = extraPrompt
    ? [extraPrompt, ...ICE_BREAKER_PROMPTS]
    : ICE_BREAKER_PROMPTS;

  return (
    <div className="flex flex-col items-center gap-3">
      <SystemMoment separator>
        {shared.length > 0 ? (
          <>
            You both like{" "}
            {shared.map((i, n) => (
              <span key={i.id} className="text-foreground font-medium">
                {n > 0 && " & "}
                <span aria-hidden>{i.emoji}</span> {i.label}
              </span>
            ))}
          </>
        ) : (
          "You're connected. Say hi 👋"
        )}
      </SystemMoment>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {prompts.map((prompt) => (
          <Button
            key={prompt}
            type="button"
            variant="outline"
            className={chip}
            onClick={() => onPrompt(prompt)}
          >
            {prompt}
          </Button>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Dismiss ice-breaker"
          className="text-muted-foreground size-8 rounded-full"
          onClick={onDismiss}
        >
          <XIcon />
        </Button>
      </div>
    </div>
  );
}
