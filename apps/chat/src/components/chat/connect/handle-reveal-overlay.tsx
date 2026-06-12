import { Button } from "@umamin/ui/components/button";
import { Copy } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { useModalTrap } from "../../../lib/use-modal-trap";
import { SeedAvatar } from "../../seed-avatar";
import type { Reactor } from "../reaction-details";
import { SendEffectOverlay } from "../send-effect-overlay";

const FLIP_DELAY_MS = 600;

function copyHandle(handle: string) {
  navigator.clipboard
    ?.writeText(handle)
    .then(() => toast("Copied — save it somewhere safe."))
    .catch(() => toast("Couldn't copy — long-press to select it instead."));
}

function FlipCard({
  who,
  handle,
  reduced,
}: {
  who: Reactor;
  handle: string;
  reduced: boolean;
}) {
  const front = (
    <div className="bg-muted flex flex-col items-center justify-center gap-2 rounded-2xl border p-4 [backface-visibility:hidden]">
      <SeedAvatar seed={who.avatarSeed} alias={who.alias} className="size-12" />
      <span className="text-muted-foreground max-w-full truncate text-xs">
        {who.alias}
      </span>
    </div>
  );
  const back = (
    <div className="bg-card absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-2xl border p-3 [backface-visibility:hidden] [transform:rotateY(180deg)]">
      <span className="text-muted-foreground max-w-full truncate text-[11px]">
        {who.alias}
      </span>
      <span className="max-w-full truncate text-sm font-bold">{handle}</span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 rounded-full text-xs"
        onClick={() => copyHandle(handle)}
      >
        <Copy /> Copy
      </Button>
    </div>
  );

  if (reduced) {
    // Crossfade-free fallback: the handle face, plainly.
    return (
      <div className="bg-card flex min-h-32 w-36 flex-col items-center justify-center gap-1.5 rounded-2xl border p-3">
        <SeedAvatar seed={who.avatarSeed} alias={who.alias} />
        <span className="max-w-full truncate text-sm font-bold">{handle}</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 rounded-full text-xs"
          onClick={() => copyHandle(handle)}
        >
          <Copy /> Copy
        </Button>
      </div>
    );
  }

  return (
    <div className="w-36 [perspective:800px]">
      {/* Both cards flip TOGETHER — mirroring "answers reveal together". */}
      <div
        className="animate-card-flip relative min-h-32 [transform-style:preserve-3d]"
        style={{ animationDelay: `${FLIP_DELAY_MS}ms` }}
      >
        {front}
        {back}
      </div>
    </div>
  );
}

/** The emotional climax: both handles flip face-up simultaneously, once per
 *  match, after both sides have submitted. */
export function HandleRevealOverlay({
  self,
  partner,
  selfHandle,
  partnerHandle,
  onClose,
}: {
  self: Reactor;
  partner: Reactor;
  selfHandle: string;
  partnerHandle: string;
  onClose: () => void;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [burst, setBurst] = useState(!reduced);

  useEffect(() => {
    closeRef.current?.focus();
    navigator.vibrate?.([15, 40, 15]);
  }, []);
  useModalTrap(dialogRef, onClose);

  return (
    <div
      ref={dialogRef}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6 text-center backdrop-blur-sm"
      style={{
        background:
          "radial-gradient(circle at 50% 40%, color-mix(in oklch, var(--primary) 18%, transparent), color-mix(in oklch, var(--background) 92%, transparent))",
      }}
    >
      {burst && (
        <SendEffectOverlay effect="hearts" onDone={() => setBurst(false)} />
      )}
      <span aria-hidden className="mb-3 text-2xl">
        ✦ 💖 ✦
      </span>
      <div className="mb-4 flex items-stretch gap-3">
        <FlipCard who={self} handle={selfHandle} reduced={reduced} />
        <FlipCard who={partner} handle={partnerHandle} reduced={reduced} />
      </div>
      <h2 id={titleId} className="font-display text-lg font-bold">
        You found each other.
      </h2>
      <p className="text-muted-foreground mt-1 mb-5 max-w-xs text-sm">
        Save these — they vanish with the chat.
      </p>
      <Button ref={closeRef} className="rounded-full" onClick={onClose}>
        Keep chatting
      </Button>
    </div>
  );
}
