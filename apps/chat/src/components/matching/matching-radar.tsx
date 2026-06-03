import { Button } from "@umamin/ui/components/button";
import { useEffect, useState } from "react";
import { interestById, MATCH_TIPS } from "../../lib/mock/data";
import { SeedAvatar } from "../seed-avatar";

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const GHOSTS = [
  { top: "12%", left: "18%" },
  { top: "22%", right: "14%" },
  { bottom: "16%", left: "28%" },
];

export function MatchingRadar({
  self,
  interests,
  onCancel,
}: {
  self: { alias: string; avatarSeed: string };
  interests: string[];
  onCancel: () => void;
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
      3000,
    );
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative flex h-full flex-col items-center justify-center p-6 text-center">
      {GHOSTS.map((pos) => (
        <span
          key={`${pos.top ?? pos.bottom}-${pos.left ?? pos.right}`}
          aria-hidden
          className="bg-muted absolute size-9 rounded-full opacity-40 blur-[1px]"
          style={pos}
        />
      ))}

      <div className="relative mb-7 flex size-32 items-center justify-center">
        <span className="border-primary absolute size-32 animate-ping rounded-full border opacity-60" />
        <span
          className="border-primary absolute size-24 animate-ping rounded-full border opacity-40"
          style={{ animationDelay: "0.5s" }}
        />
        <span
          aria-hidden
          className="bg-primary/20 absolute size-20 rounded-full blur-md"
        />
        <SeedAvatar
          seed={self.avatarSeed}
          alias={self.alias}
          className="size-16"
        />
      </div>

      <h2 className="font-display text-lg font-bold">
        Finding someone for you…
      </h2>

      <div className="mt-3 flex flex-wrap justify-center gap-1.5">
        {(interests.length > 0 ? interests : ["anyone"]).map((id) => {
          const it = interestById(id);
          return (
            <span
              key={id}
              className="border-primary/30 bg-primary/10 text-primary rounded-full border px-2.5 py-0.5 text-[11px]"
            >
              {it ? `${it.emoji} ${it.label}` : "Anyone"}
            </span>
          );
        })}
      </div>

      <p className="text-muted-foreground mt-3 text-[11px] tabular-nums">
        searching · {formatElapsed(elapsed)}
      </p>

      <p className="text-muted-foreground mt-5 max-w-xs text-xs">
        <span className="font-medium">Tip:</span> {MATCH_TIPS[tipIndex]}
      </p>

      <Button
        variant="outline"
        className="mt-6 rounded-full"
        onClick={onCancel}
      >
        Cancel
      </Button>
    </div>
  );
}
