import type { InfiniteData } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@umamin/ui/components/avatar";
import { Button } from "@umamin/ui/components/button";
import { Textarea } from "@umamin/ui/components/textarea";
import { cn } from "@umamin/ui/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { Loader2Icon, ScanFaceIcon, SendIcon } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useDynamicTextarea } from "@/hooks/use-dynamic-textarea";
import { useSingleFlightAction } from "@/hooks/use-single-flight-action";
import { PRIVATE_STALE_TIME, queryKeys } from "@/lib/query";
import { patchMessage } from "@/lib/query-cache";
import { fetchMessageThread } from "@/lib/query-fetchers";
import type { MessagesResponse, MessageThreadResponse } from "@/lib/types";
import {
  createReplyAction,
  markThreadReadAction,
  openMessageAction,
} from "./actions";

function Bubble({
  mine,
  avatarUrl,
  children,
}: {
  mine: boolean;
  // null renders the anonymous fallback; only known counterparts get an image.
  avatarUrl: string | null;
  children: ReactNode;
}) {
  if (mine) {
    return (
      <div className="max-w-[75%] sm:max-w-[55%] rounded-lg px-3 py-2 whitespace-pre-wrap bg-primary text-primary-foreground self-end break-words">
        {children}
      </div>
    );
  }

  return (
    <div className="flex gap-2 items-end">
      <Avatar>
        <AvatarImage className="rounded-full" src={avatarUrl ?? ""} />
        <AvatarFallback>
          <ScanFaceIcon />
        </AvatarFallback>
      </Avatar>
      <div className="max-w-[75%] sm:max-w-[55%] rounded-lg px-3 py-2 whitespace-pre-wrap bg-muted min-w-0 break-words">
        {children}
      </div>
    </div>
  );
}

export function MessageThreadView({ messageId }: { messageId: string }) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const inputRef = useDynamicTextarea(content);
  const submitReply = useSingleFlightAction(createReplyAction);
  const markedRef = useRef(false);

  const { data, isError } = useQuery({
    queryKey: queryKeys.messageThread(messageId),
    queryFn: () => fetchMessageThread(messageId),
    staleTime: PRIVATE_STALE_TIME,
    // Deliberately fresher than privateQueryDefaults: this is a conversation,
    // so coming back to the tab should pick up the other side's reply.
    refetchOnWindowFocus: true,
  });

  // Watermark + seal writes, once per mount (never per refetch).
  useEffect(() => {
    if (!data || markedRef.current) return;
    markedRef.current = true;
    void markThreadReadAction({ messageId });
    if (data.viewerRole === "receiver" && !data.message.openedAt) {
      void openMessageAction({ messageId });
    }
    // The inbox lists don't refetch on remount, so clear the unread dot in
    // their caches directly (each list only carries its own side's watermark).
    const now = new Date();
    for (const key of [
      queryKeys.receivedMessages(),
      queryKeys.sentMessages(),
    ]) {
      queryClient.setQueryData<InfiniteData<MessagesResponse>>(key, (current) =>
        patchMessage(current, messageId, (message) => ({
          ...message,
          receiverReadAt: now,
          senderReadAt: now,
        })),
      );
    }
  }, [data, messageId, queryClient]);

  const mutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await submitReply({ messageId, content: text });
      if (res && "error" in res && res.error) {
        throw new Error(res.error);
      }
      return res;
    },
    onSuccess: (res) => {
      queryClient.setQueryData<MessageThreadResponse>(
        queryKeys.messageThread(messageId),
        (current) => {
          if (!current) return current;
          if ("entry" in res && res.entry) {
            const entry = {
              ...res.entry,
              createdAt: new Date(res.entry.createdAt),
            };
            return { ...current, replies: [...current.replies, entry] };
          }
          if ("reply" in res && res.reply) {
            return {
              ...current,
              message: { ...current.message, reply: res.reply },
            };
          }
          return current;
        },
      );
      setContent("");
      // List previews (reply snippet, unread state) are stale now.
      void queryClient.invalidateQueries({
        queryKey: queryKeys.receivedMessages(),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.sentMessages(),
      });
    },
    onError: (err) => {
      console.error(err);
      toast.error("Couldn't send reply.");
    },
  });

  if (isError) {
    return (
      <p className="mt-20 text-center text-sm text-muted-foreground">
        This conversation is no longer available.
      </p>
    );
  }

  if (!data) {
    return null;
  }

  const { message, replies, viewerRole, threadable } = data;
  const isReceiver = viewerRole === "receiver";
  // The known counterpart is the receiver; the sender side is always the
  // anonymous fallback.
  const counterpartAvatar = isReceiver ? null : message.receiver.imageUrl;

  const entries = [
    { id: "content", content: message.content, fromSender: true },
    ...(message.reply
      ? [{ id: "legacy-reply", content: message.reply, fromSender: false }]
      : []),
    ...replies,
  ];

  const canReply = isReceiver
    ? threadable || !message.reply
    : Boolean(message.reply);

  return (
    <div className="flex flex-col">
      <h3 className="font-bold text-center leading-normal text-lg min-w-0 break-words mb-10">
        {message.question}
      </h3>

      <div className="flex flex-col gap-4">
        {entries.map((entry) => (
          <Bubble
            key={entry.id}
            mine={entry.fromSender !== isReceiver}
            avatarUrl={counterpartAvatar}
          >
            {entry.content}
          </Bubble>
        ))}
      </div>

      <p className="text-muted-foreground text-sm mt-6 italic text-center">
        started{" "}
        {formatDistanceToNow(message.createdAt, {
          addSuffix: true,
        })}
      </p>

      <div className={cn("mt-8", "pb-[env(safe-area-inset-bottom)]")}>
        {canReply ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = content.trim();
              if (trimmed) mutation.mutate(trimmed);
            }}
            className="flex items-center gap-2"
          >
            <Textarea
              id="thread-reply"
              required
              ref={inputRef}
              disabled={mutation.isPending}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={500}
              placeholder={
                isReceiver ? "Type your reply..." : "Send another message..."
              }
              className="focus-visible:ring-transparent flex-1 text-base resize-none min-h-10 max-h-20"
              autoComplete="off"
            />
            <Button type="submit" size="icon" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <Loader2Icon className="w-4 h-4 animate-spin" />
              ) : (
                <SendIcon className="h-4 w-4" />
              )}
              <span className="sr-only">Send</span>
            </Button>
          </form>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            {isReceiver
              ? "This conversation can't continue — the sender wasn't signed in."
              : "You can send another message once they reply."}
          </p>
        )}
      </div>
    </div>
  );
}
