import { Button } from "@umamin/ui/components/button";
import { useEffect, useId, useRef } from "react";
import { SeedAvatar } from "../seed-avatar";

export function StayConnectedCelebration({
  selfAlias,
  selfSeed,
  partnerAlias,
  partnerSeed,
  onContinue,
}: {
  selfAlias: string;
  selfSeed: string;
  partnerAlias: string;
  partnerSeed: string;
  onContinue: () => void;
}) {
  const titleId = useId();
  const continueRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    continueRef.current?.focus();
  }, []);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6 text-center backdrop-blur-sm"
      style={{
        background:
          "radial-gradient(circle at 50% 35%, color-mix(in oklch, var(--primary) 18%, transparent), color-mix(in oklch, var(--background) 90%, transparent))",
      }}
    >
      <div className="mb-4 flex items-center">
        <SeedAvatar seed={selfSeed} alias={selfAlias} className="size-12" />
        <span aria-hidden className="z-10 -mx-2 text-2xl">
          💖
        </span>
        <SeedAvatar
          seed={partnerSeed}
          alias={partnerAlias}
          className="size-12"
        />
      </div>
      <h2 id={titleId} className="font-display text-lg font-bold">
        It's mutual!
      </h2>
      <p className="text-muted-foreground mt-1 mb-5 max-w-xs text-sm">
        You and {partnerAlias} both want to keep talking.
      </p>
      <Button ref={continueRef} className="rounded-full" onClick={onContinue}>
        Keep chatting
      </Button>
    </div>
  );
}
