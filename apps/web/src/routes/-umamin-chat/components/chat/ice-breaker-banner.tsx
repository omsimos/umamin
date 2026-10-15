import { Button } from "@umamin/ui/components/button";
import { XIcon } from "lucide-react";
import { useState } from "react";
import { ICE_BREAKER_PROMPTS, interestById } from "@/lib/chat/content";
import { SystemMoment } from "./system-moment";

const MAX_PROMPTS = 3;

const chip =
  "bg-background hover:bg-muted h-auto min-h-8 rounded-full px-3 py-1.5 text-xs font-normal whitespace-normal";

/** The warm-up pick first, then an opener for the first shared interest, then
 *  random generic prompts to fill the row. */
export function pickIceBreakers(
  sharedInterests: string[],
  extraPrompt: string | null | undefined,
  random: () => number = Math.random,
): string[] {
  const picks: string[] = [];
  if (extraPrompt) picks.push(extraPrompt);
  const opener = interestById(sharedInterests[0] ?? "")?.opener;
  if (opener) picks.push(opener);
  const pool = [...ICE_BREAKER_PROMPTS];
  while (picks.length < MAX_PROMPTS && pool.length > 0) {
    picks.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  }
  return picks;
}

export function IceBreakerBanner({
  sharedInterests,
  extraPrompt,
  onPrompt,
  onPlay,
  onDismiss,
  random,
}: {
  sharedInterests: string[];
  /** The radar warm-up's last pick: wait time turned into an opener. */
  extraPrompt?: string | null;
  onPrompt: (text: string) => void;
  /** Starts a quick game instead of an opener. Absent = no game chip. */
  onPlay?: () => void;
  onDismiss: () => void;
  random?: () => number;
}) {
  const shared = sharedInterests
    .map((id) => interestById(id))
    .filter((i) => i !== undefined);
  // Picked once per mount so the chips don't reshuffle on every render.
  const [prompts] = useState(() =>
    pickIceBreakers(sharedInterests, extraPrompt, random),
  );

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
        {onPlay && (
          <Button
            type="button"
            variant="outline"
            className={chip}
            onClick={onPlay}
          >
            <span aria-hidden>⚡</span> Play This or That
          </Button>
        )}
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
