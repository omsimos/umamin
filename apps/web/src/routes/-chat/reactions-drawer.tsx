import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarImage } from "@umamin/ui/components/avatar";
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
import { Loader2Icon } from "lucide-react";
import { BlobatarFallback } from "@/components/blobatar-fallback";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Link } from "@/lib/navigation";
import { fetchGroupMessageReactors } from "@/lib/query-fetchers";
import type { GroupMessageReactor } from "@/lib/types";

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
          <Link
            href={`/user/${r.user.username}`}
            aria-label={`@${r.user.username}'s profile`}
            className="shrink-0"
          >
            <Avatar className="size-9">
              <AvatarImage src={r.user.imageUrl ?? ""} alt="" />
              <BlobatarFallback seed={r.user.id} />
            </Avatar>
          </Link>
          <Link
            href={`/user/${r.user.username}`}
            className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
          >
            {r.user.displayName ?? r.user.username}
            {r.user.id === currentUserId && (
              <span className="font-normal text-muted-foreground"> (you)</span>
            )}
          </Link>
          <span aria-hidden className="text-xl leading-none">
            {r.emoji}
          </span>
          <span className="sr-only">reacted {r.emoji}</span>
        </li>
      ))}
    </ul>
  );
}

// Who-reacted view for a message. Responsive dialog (desktop) / drawer (mobile).
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
