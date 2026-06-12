import { Button } from "@umamin/ui/components/button";
import { useEffect, useId, useRef } from "react";
import { useModalTrap } from "../../lib/use-modal-trap";
import { SeedAvatar } from "../seed-avatar";

export function StayConnectedCelebration({
  selfAlias,
  selfSeed,
  partnerAlias,
  partnerSeed,
  onContinue,
  onDropHandle,
}: {
  selfAlias: string;
  selfSeed: string;
  partnerAlias: string;
  partnerSeed: string;
  onContinue: () => void;
  /** Opens the handle exchange — the payoff mutual hearts unlocked. */
  onDropHandle?: () => void;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    primaryRef.current?.focus();
  }, []);
  useModalTrap(dialogRef, onContinue);

  return (
    <div
      ref={dialogRef}
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
        {onDropHandle &&
          " Want this to outlive the poof? Swap handles — only revealed if you both do."}
      </p>
      {onDropHandle ? (
        <>
          <Button
            ref={primaryRef}
            className="rounded-full"
            onClick={onDropHandle}
          >
            Drop a handle 🔗
          </Button>
          <Button
            variant="ghost"
            className="text-muted-foreground mt-2"
            onClick={onContinue}
          >
            Keep chatting
          </Button>
        </>
      ) : (
        <Button ref={primaryRef} className="rounded-full" onClick={onContinue}>
          Keep chatting
        </Button>
      )}
    </div>
  );
}
