"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@umamin/ui/components/avatar";
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
import { Loader2Icon, ScanFaceIcon } from "lucide-react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { fetchGroupMessageReactors } from "@/lib/query-fetchers";
import type { GroupMessageReactor } from "@/lib/query-types";

function ReactorList({
  reactors,
  loading,
  currentUserId,
}: {
  reactors: GroupMessageReactor[];
  loading: boolean;
  currentUserId: string;
}) {
  if (loading) {
    return (
      <p className="flex justify-center py-6 text-muted-foreground">
        <Loader2Icon className="size-5 animate-spin" />
      </p>
    );
  }

  if (reactors.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No reactions yet.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1">
      {reactors.map((r) => (
        <li
          key={`${r.user.id}-${r.emoji}`}
          className="flex items-center gap-3 py-1.5"
        >
          <Avatar className="size-9">
            <AvatarImage src={r.user.imageUrl ?? ""} alt="" />
            <AvatarFallback>
              <ScanFaceIcon className="size-4" />
            </AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {r.user.displayName ?? r.user.username}
            {r.user.id === currentUserId && (
              <span className="font-normal text-muted-foreground"> (you)</span>
            )}
          </span>
          <span aria-hidden className="text-xl leading-none">
            {r.emoji}
          </span>
          <span className="sr-only">reacted {r.emoji}</span>
        </li>
      ))}
    </ul>
  );
}

// Who-reacted view for a message. Opens when `messageId` is set; responsive
// dialog (desktop) / drawer (mobile), mirroring apps/chat's ReactionDetails.
export function ReactionsDrawer({
  tag,
  messageId,
  currentUserId,
  onClose,
}: {
  tag: string;
  messageId: string | null;
  currentUserId: string;
  onClose: () => void;
}) {
  const open = messageId !== null;
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const { data, isLoading } = useQuery({
    queryKey: ["group-chat-reactors", tag, messageId],
    queryFn: () => fetchGroupMessageReactors(tag, messageId as string),
    enabled: open,
    staleTime: 0,
  });

  const handleOpenChange = (next: boolean) => {
    if (!next) onClose();
  };

  const list = (
    <ReactorList
      reactors={data ?? []}
      loading={open && isLoading}
      currentUserId={currentUserId}
    />
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reactions</DialogTitle>
            <DialogDescription className="sr-only">
              Who reacted to this message
            </DialogDescription>
          </DialogHeader>
          {list}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Reactions</DrawerTitle>
          <DrawerDescription className="sr-only">
            Who reacted to this message
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-6">{list}</div>
      </DrawerContent>
    </Drawer>
  );
}
