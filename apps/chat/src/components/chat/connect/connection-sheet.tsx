import { Button } from "@umamin/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@umamin/ui/components/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@umamin/ui/components/drawer";
import { Input } from "@umamin/ui/components/input";
import { Copy } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { MAX_REVEAL_HANDLE_LEN } from "../../../../convex/constants";
import type { RevealState } from "../../../lib/session/types";
import { useMediaQuery } from "../../../lib/use-media-query";
import { SeedAvatar } from "../../seed-avatar";
import type { Reactor } from "../reaction-details";

function copyHandle(handle: string) {
  navigator.clipboard
    ?.writeText(handle)
    .then(() => toast("Copied — save it somewhere safe."))
    .catch(() => toast("Couldn't copy — long-press to select it instead."));
}

function HandleCard({ who, handle }: { who: Reactor; handle: string }) {
  return (
    <div className="bg-muted/50 flex items-center gap-3 rounded-xl border px-3 py-2.5">
      <SeedAvatar seed={who.avatarSeed} alias={who.alias} />
      <span className="min-w-0 flex-1">
        <span className="text-muted-foreground block truncate text-xs">
          {who.alias}
        </span>
        <span className="block truncate text-sm font-semibold">{handle}</span>
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Copy ${who.alias}'s handle`}
        className="shrink-0 rounded-full"
        onClick={() => copyHandle(handle)}
      >
        <Copy />
      </Button>
    </div>
  );
}

function ConnectionBody({
  reveal,
  self,
  partner,
  onSubmit,
  onWithdraw,
  onClose,
}: {
  reveal: RevealState;
  self: Reactor;
  partner: Reactor;
  onSubmit: (handle: string) => void;
  onWithdraw: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState("");
  const revealed = Boolean(reveal.self.handle && reveal.partner.handle);

  if (revealed) {
    return (
      <div className="flex flex-col gap-2">
        <HandleCard who={partner} handle={reveal.partner.handle ?? ""} />
        <HandleCard who={self} handle={reveal.self.handle ?? ""} />
        <p className="text-muted-foreground mt-1 text-center text-xs">
          Save these — they vanish with the chat.
        </p>
      </div>
    );
  }

  if (reveal.self.submitted) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="bg-muted/50 w-full rounded-xl border px-3 py-2.5">
          <p className="text-muted-foreground text-xs">You shared</p>
          <p className="truncate text-sm font-semibold">{reveal.self.handle}</p>
        </div>
        <p className="text-muted-foreground animate-pulse text-sm">
          Shared ✓ — waiting for {partner.alias}…
        </p>
        <Button
          variant="ghost"
          className="text-muted-foreground"
          onClick={onWithdraw}
        >
          Take it back
        </Button>
      </div>
    );
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setDraft("");
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="text-muted-foreground text-center text-sm">
        {reveal.partner.submitted
          ? `${partner.alias} has already shared. Add yours to reveal both.`
          : "Shown only if you BOTH share. Never on receipts."}
      </p>
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="@yourhandle · IG, Discord, anything"
        aria-label="Your handle"
        maxLength={MAX_REVEAL_HANDLE_LEN}
        className="rounded-full text-center"
      />
      <Button
        type="submit"
        className="rounded-full"
        disabled={draft.trim().length === 0}
      >
        Share my handle
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="text-muted-foreground"
        onClick={onClose}
      >
        Not now
      </Button>
    </form>
  );
}

/** The handle exchange behind mutual hearts. Re-entered any time via the
 *  header heart; bottom sheet on mobile, dialog at the rail breakpoint. */
export function ConnectionSheet({
  open,
  onOpenChange,
  reveal,
  self,
  partner,
  onSubmit,
  onWithdraw,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reveal: RevealState;
  self: Reactor;
  partner: Reactor;
  onSubmit: (handle: string) => void;
  onWithdraw: () => void;
}) {
  // Same breakpoint as the shell's rail/drawer split (lg).
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const title = "Swap handles?";
  const description = "Exchange a handle to stay connected after the chat";
  const body = (
    <ConnectionBody
      reveal={reveal}
      self={self}
      partner={partner}
      onSubmit={onSubmit}
      onWithdraw={onWithdraw}
      onClose={() => onOpenChange(false)}
    />
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className="sr-only">
              {description}
            </DialogDescription>
          </DialogHeader>
          {body}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription className="sr-only">
            {description}
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-6">{body}</div>
      </DrawerContent>
    </Drawer>
  );
}
