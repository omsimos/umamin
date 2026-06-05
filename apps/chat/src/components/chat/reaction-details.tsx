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
import type { MessageReaction } from "../../lib/session/types";
import { useMediaQuery } from "../../lib/use-media-query";
import { SeedAvatar } from "../seed-avatar";

export interface Reactor {
  alias: string;
  avatarSeed: string;
}

function ReactorList({
  reactions,
  self,
  partner,
}: {
  reactions: MessageReaction[];
  self: Reactor;
  partner: Reactor;
}) {
  return (
    <ul className="flex flex-col gap-1">
      {reactions.map((reaction) => {
        const who = reaction.by === "self" ? self : partner;
        return (
          // One reaction per user, so "by" is unique within a message.
          <li key={reaction.by} className="flex items-center gap-3 py-1.5">
            <SeedAvatar seed={who.avatarSeed} alias={who.alias} />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {who.alias}
              {reaction.by === "self" && (
                <span className="text-muted-foreground font-normal">
                  {" "}
                  (you)
                </span>
              )}
            </span>
            <span aria-hidden className="text-xl leading-none">
              {reaction.emoji}
            </span>
            <span className="sr-only">reacted {reaction.emoji}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function ReactionDetails({
  open,
  onOpenChange,
  reactions,
  self,
  partner,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reactions: MessageReaction[];
  self: Reactor;
  partner: Reactor;
}) {
  // Same breakpoint as the shell's rail/drawer split (lg).
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reactions</DialogTitle>
            <DialogDescription className="sr-only">
              Who reacted to this message
            </DialogDescription>
          </DialogHeader>
          <ReactorList reactions={reactions} self={self} partner={partner} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Reactions</DrawerTitle>
          <DrawerDescription className="sr-only">
            Who reacted to this message
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-6">
          <ReactorList reactions={reactions} self={self} partner={partner} />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
