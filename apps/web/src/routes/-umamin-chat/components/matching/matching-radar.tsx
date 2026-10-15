import { Badge } from "@umamin/ui/components/badge";
import { Button } from "@umamin/ui/components/button";
import { useEffect, useState } from "react";
import { interestById, MATCH_TIPS } from "@/lib/chat/content";
import { SeedAvatar } from "../seed-avatar";
import { WarmupCard } from "./warmup-card";

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function MatchingRadar({
  self,
  interests,
  onCancel,
  onWarmupPick,
}: {
  self: { alias: string; avatarSeed: string };
  interests: string[];
  onCancel: () => void;
  /** Latest warm-up pick, offered as an ice-breaker once matched. */
  onWarmupPick?: (prompt: string) => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(
      () => setTipIndex((i) => (i + 1) % MATCH_TIPS.length),
      4000,
    );
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center overflow-y-auto px-6 py-10 text-center">
      <div className="my-auto flex w-full max-w-sm flex-col items-center">
        <div className="relative flex size-20 items-center justify-center">
          <span
            aria-hidden
            className="bg-primary/15 absolute inset-0 animate-ping rounded-full [animation-duration:2s] motion-reduce:animate-none"
          />
          <SeedAvatar
            seed={self.avatarSeed}
            alias={self.alias}
            className="ring-background relative size-16 ring-4"
          />
        </div>

        <h2 className="mt-5 text-lg font-semibold">Finding someone for you</h2>
        <p
          className="text-muted-foreground mt-1 text-sm tabular-nums"
          aria-live="off"
        >
          Searching · {formatElapsed(elapsed)}
        </p>

        <div className="mt-4 flex flex-wrap justify-center gap-1.5">
          {interests.length > 0 ? (
            interests.map((id) => {
              const it = interestById(id);
              return (
                <Badge key={id} variant="secondary" className="font-normal">
                  {it ? `${it.emoji} ${it.label}` : id}
                </Badge>
              );
            })
          ) : (
            <Badge variant="secondary" className="font-normal">
              Anyone
            </Badge>
          )}
        </div>

        <WarmupCard onPick={onWarmupPick} />

        <p
          key={tipIndex}
          className="text-muted-foreground animate-chat-pop-in mt-5 text-xs motion-reduce:animate-none"
        >
          <span className="text-foreground font-medium">Tip:</span>{" "}
          {MATCH_TIPS[tipIndex]}
        </p>

        <Button variant="outline" className="mt-6 w-full" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
