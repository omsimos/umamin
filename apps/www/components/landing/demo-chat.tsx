"use client";

import { FlameIcon } from "lucide-react";
import { useEffect, useState } from "react";

const INTERESTS = ["music", "late-night talks", "anime"];
const MATCH_INTEREST = "late-night talks";
const STEP_MS = [1600, 1200, 1300, 1600, 1300, 1900, 2400];

function TypingDots({ className }: { className?: string }) {
  return (
    <span className={`flex items-center gap-1 ${className ?? ""}`}>
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          style={{ animationDelay: `${delay}ms` }}
          className="size-1.5 animate-typing-dot rounded-full bg-muted-foreground motion-reduce:animate-none"
        />
      ))}
    </span>
  );
}

export function DemoChat() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const id = setTimeout(
      () => setPhase((p) => (p + 1) % STEP_MS.length),
      STEP_MS[phase],
    );
    return () => clearTimeout(id);
  }, [phase]);

  return (
    <div className="flex h-full flex-col" aria-live="off">
      <div className="flex flex-wrap items-center gap-1.5">
        {INTERESTS.map((interest) => (
          <span
            key={interest}
            className={`rounded-full border px-2.5 py-1 text-xs transition-all duration-300 ${
              phase >= 1 && interest === MATCH_INTEREST
                ? "border-violet-400 bg-violet-400/15 text-violet-400"
                : "text-muted-foreground"
            } ${phase === 0 ? "animate-pulse motion-reduce:animate-none" : ""}`}
          >
            {interest}
          </span>
        ))}
      </div>

      <div className="flex min-h-44 flex-1 flex-col gap-2.5 py-4">
        {phase === 0 && (
          <p className="text-sm text-muted-foreground">
            finding someone into late-night talks…
          </p>
        )}

        {phase >= 1 && (
          <p className="animate-rise text-xs font-medium text-violet-400">
            ✦ Matched with Wandering Fox
          </p>
        )}

        {phase === 2 && <TypingDots className="px-1" />}

        {phase >= 3 && (
          <div className="max-w-[85%] animate-rise rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm">
            okay, weirdest food combo you secretly defend?
          </div>
        )}

        {phase === 4 && <TypingDots className="self-end px-1" />}

        {phase >= 5 && (
          <div className="max-w-[85%] animate-rise self-end rounded-2xl rounded-br-sm bg-violet-500 px-3 py-2 text-sm text-white">
            fries dipped in ice cream. zero shame.
          </div>
        )}

        <p
          className={`flex items-center gap-1 self-center pt-1 text-xs text-muted-foreground ${
            phase >= 6 ? "animate-rise" : "invisible"
          }`}
        >
          <FlameIcon className="size-3 text-violet-400" />
          chat ended — nothing was saved, anywhere
        </p>
      </div>

      <p className="text-sm text-muted-foreground">
        Matched by interests, gone in an hour. No account, no history.
      </p>
    </div>
  );
}
