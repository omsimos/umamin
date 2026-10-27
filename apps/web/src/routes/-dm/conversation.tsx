import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@umamin/ui/components/alert-dialog";
import { Avatar, AvatarImage } from "@umamin/ui/components/avatar";
import { Button } from "@umamin/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@umamin/ui/components/dropdown-menu";
import {
  CircleUserRoundIcon,
  EllipsisVerticalIcon,
  Loader2Icon,
  MessageSquareXIcon,
  Trash2Icon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BlobatarFallback } from "@/components/blobatar-fallback";
import { blockUserAction, hideDmThreadAction } from "@/lib/actions";
import type { UiDmMessage } from "@/lib/dm/client-state";
import type { DmErrorCode } from "@/lib/dm/protocol";
import type { DmPeerResponse, DmReplyPreview } from "@/lib/dm/types";
import { Link, useAppNavigate } from "@/lib/navigation";
import {
  SessionBackButton,
  SessionFrame,
  SessionHeader,
} from "../-umamin-chat/components/shell/session-frame";
import { DmComposer } from "./dm-composer";
import { DmMessageList } from "./dm-message-list";
import { ReportDrawer } from "./report-drawer";
import { useDmConversation } from "./use-dm-conversation";

type Peer = DmPeerResponse["peer"];

const ERROR_TOASTS: Partial<Record<DmErrorCode | "offline", string>> = {
  rate_limited: "You're sending too fast. Wait a moment and try again.",
  closed: "You can't send messages in this chat right now.",
  offline: "Reconnecting. Try that again in a moment.",
};

function toastFor(code: DmErrorCode | "offline") {
  toast.error(ERROR_TOASTS[code] ?? "Something went wrong. Please try again.");
}

function PeerAvatar({ peer, className }: { peer: Peer; className?: string }) {
  return (
    <Avatar className={className}>
      <AvatarImage src={peer.imageUrl ?? ""} alt="" />
      <BlobatarFallback seed={peer.id} />
    </Avatar>
  );
}

function BackToChats() {
  const navigate = useAppNavigate();
  return (
    <SessionBackButton
      label="Back to chats"
      onClick={() => navigate("/inbox?tab=chats")}
    />
  );
}

/** Unknown user, a block, or no mutual follow and no history yet. */
export function DmUnavailable({
  username,
  reason,
}: {
  username: string;
  reason: "missing" | "not-mutual" | "closed";
}) {
  const copy = {
    missing: "This chat isn't available.",
    "not-mutual": `You can message @${username} once you follow each other.`,
    closed: "This chat is no longer available.",
  }[reason];
  return (
    <SessionFrame
      header={
        <SessionHeader>
          <BackToChats />
          <p className="min-w-0 flex-1 truncate px-1 text-sm font-semibold">
            @{username}
          </p>
        </SessionHeader>
      }
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-muted-foreground text-sm">{copy}</p>
        {reason === "not-mutual" && (
          <Button asChild variant="outline" size="sm">
            <Link href={`/user/${username}`}>View profile</Link>
          </Button>
        )}
      </div>
    </SessionFrame>
  );
}

export function DmConversationScreen({
  peer,
  onLeave,
}: {
  peer: Peer;
  onLeave: () => void;
}) {
  const navigate = useAppNavigate();
  const convo = useDmConversation(peer.username, toastFor);
  const { state } = convo;
  const [replyTarget, setReplyTarget] = useState<UiDmMessage | null>(null);
  const [reporting, setReporting] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"delete" | "block" | null>(null);
  const peerName = peer.displayName ?? peer.username;

  useEffect(() => onLeave, [onLeave]);

  if (state.status === "unavailable") {
    return <DmUnavailable username={peer.username} reason="closed" />;
  }

  const meta = state.meta;
  const canSend = meta?.canSend ?? false;
  const statusLine = convo.peerTyping
    ? "Typing…"
    : state.status !== "open"
      ? "Connecting…"
      : meta?.peerOnline
        ? "Online"
        : null;

  async function runConfirmed() {
    const kind = confirm;
    setConfirm(null);
    if (kind === "delete") {
      const res = await hideDmThreadAction({ username: peer.username });
      if (res && "error" in res) {
        toast.error(res.error);
        return;
      }
      navigate("/inbox?tab=chats");
    } else if (kind === "block") {
      const res = await blockUserAction({ userId: peer.id });
      if (res && "error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(`Blocked @${peer.username}`);
      navigate("/inbox?tab=chats");
    }
  }

  const replyPreview: DmReplyPreview | null =
    replyTarget && replyTarget.text !== null
      ? { id: replyTarget.id, mine: replyTarget.mine, text: replyTarget.text }
      : null;

  return (
    <SessionFrame
      header={
        <SessionHeader>
          <BackToChats />
          <Link
            href={`/user/${peer.username}`}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1 py-1"
          >
            <PeerAvatar peer={peer} className="size-9" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">
                {peerName}
              </span>
              <span className="text-muted-foreground block truncate text-xs">
                {statusLine ?? `@${peer.username}`}
              </span>
            </span>
          </Link>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Chat options"
                className="shrink-0 rounded-full"
              >
                <EllipsisVerticalIcon className="size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/user/${peer.username}`}>
                  <span className="flex items-center gap-2">
                    <CircleUserRoundIcon className="size-4" />
                    View profile
                  </span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setConfirm("delete")}>
                <span className="flex items-center gap-2">
                  <Trash2Icon className="size-4" />
                  Delete chat
                </span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-500"
                onClick={() => setConfirm("block")}
              >
                <span className="flex items-center gap-2">
                  <MessageSquareXIcon className="size-4" />
                  Block
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SessionHeader>
      }
    >
      {state.status === "connecting" && !meta ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2Icon
            aria-label="Loading chat"
            className="text-muted-foreground size-6 animate-spin"
          />
        </div>
      ) : (
        <DmMessageList
          messages={state.messages}
          peerName={peerName}
          peerTyping={convo.peerTyping}
          peerReadSeq={meta?.peerReadSeq ?? 0}
          canInteract={canSend}
          hasMore={state.hasMore}
          loadingOlder={state.loadingOlder}
          onLoadOlder={convo.loadOlder}
          onReact={async (id, emoji) => {
            const res = await convo.react(id, emoji);
            if (!res.ok) toastFor(res.code);
          }}
          onReply={setReplyTarget}
          onUnsend={async (id) => {
            const res = await convo.unsend(id);
            if (!res.ok) toastFor(res.code);
          }}
          onReport={setReporting}
          onRetry={convo.retry}
          empty={
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <PeerAvatar peer={peer} className="size-16" />
              <p className="text-sm font-semibold">{peerName}</p>
              <p className="text-muted-foreground text-xs">
                Say hi to @{peer.username}. Only the two of you can see this
                chat.
              </p>
            </div>
          }
        />
      )}

      {canSend ? (
        <DmComposer
          onSend={(text) => {
            convo.send(text, replyPreview);
            setReplyTarget(null);
          }}
          onTyping={convo.setTyping}
          replyTo={
            replyPreview
              ? {
                  authorLabel: replyPreview.mine ? "yourself" : peerName,
                  text: replyPreview.text ?? "",
                }
              : null
          }
          onCancelReply={() => setReplyTarget(null)}
        />
      ) : (
        meta && (
          <p className="text-muted-foreground shrink-0 border-t px-6 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-xs">
            You can message each other again when you follow each other.
          </p>
        )
      )}

      <ReportDrawer
        open={reporting !== null}
        onOpenChange={(open) => !open && setReporting(null)}
        peerName={peerName}
        onSubmit={async (reason, block) => {
          if (!reporting) return;
          const res = await convo.report(reporting, reason);
          if (!res.ok) {
            toast.error(
              res.code === "reported"
                ? "You already reported this message."
                : res.code === "rate_limited"
                  ? "You reported this chat recently. Try again later."
                  : "Couldn't send the report. Please try again.",
            );
            return;
          }
          toast.success("Thanks. A moderator will review it.");
          if (block) setConfirm("block");
        }}
      />

      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "block"
                ? `Block @${peer.username}?`
                : "Delete chat?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "block"
                ? "They won't be able to message you, and this chat closes for both of you."
                : `This removes the chat from your list. ${peerName} still has their copy.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void runConfirmed()}>
              {confirm === "block" ? "Block" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SessionFrame>
  );
}
