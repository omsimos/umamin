import type { InfiniteData } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChatAvatar,
  ChatBubble,
  ChatComposer,
  ChatComposerInput,
  ChatComposerSend,
  ChatDaySeparator,
  ChatMeta,
  ChatRow,
  ChatThread,
} from "@umamin/ui/components/chat";
import { Skeleton } from "@umamin/ui/components/skeleton";
import { LockIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useDynamicTextarea } from "@/hooks/use-dynamic-textarea";
import { useSingleFlightAction } from "@/hooks/use-single-flight-action";
import { Link } from "@/lib/navigation";
import { PRIVATE_STALE_TIME, queryKeys } from "@/lib/query";
import { patchMessage } from "@/lib/query-cache";
import { fetchMessageThread } from "@/lib/query-fetchers";
import type { MessagesResponse, MessageThreadResponse } from "@/lib/types";
import {
  createReplyAction,
  markThreadReadAction,
  openMessageAction,
} from "./actions";
import { buildThreadTimeline } from "./thread-timeline";

const MAX_LENGTH = 500;
const COUNTER_VISIBLE_AT = 400;

const timeFormat = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

function ThreadHeader({ data }: { data: MessageThreadResponse }) {
  const isReceiver = data.viewerRole === "receiver";
  const receiver = data.message.receiver;

  return (
    <div className="flex items-center gap-3 border-b pb-4">
      {isReceiver ? (
        <ChatAvatar className="size-10" src={null} />
      ) : (
        <Link href={`/user/${receiver.username}`} className="shrink-0">
          <ChatAvatar className="size-10" src={receiver.imageUrl} />
        </Link>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-sm">
          {isReceiver ? (
            "Anonymous"
          ) : (
            <Link
              href={`/user/${receiver.username}`}
              className="hover:underline"
            >
              {receiver.displayName ?? receiver.username}
            </Link>
          )}
        </p>
        <p className="truncate text-muted-foreground text-xs">
          {isReceiver
            ? "You don't know who this is"
            : "They don't know it's you"}
        </p>
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
      <p className="mt-20 text-center text-muted-foreground text-sm">
        This conversation is no longer available.
      </p>
    );
  }

  if (!data) {
    return <ThreadViewSkeleton />;
  }

  const { message, viewerRole, threadable } = data;
  const isReceiver = viewerRole === "receiver";
  const counterpartAvatar = isReceiver ? null : message.receiver.imageUrl;
  const { items } = buildThreadTimeline(data);

  const canReply = isReceiver
    ? threadable || !message.reply
    : Boolean(message.reply);
  const remaining = MAX_LENGTH - content.length;

  return (
    <div className="flex flex-col">
      <ThreadHeader data={data} />

      <div className="mt-5 rounded-xl border bg-muted/30 px-4 py-3 text-center">
        <p className="text-muted-foreground text-xs">
          {isReceiver ? "Your prompt" : "Their prompt"}
        </p>
        <p className="mt-1 break-words font-semibold text-sm leading-snug">
          {message.question}
        </p>
      </div>

      <ChatThread className="mt-5">
        {items.map((item) =>
          item.kind === "day" ? (
            <ChatDaySeparator key={item.key}>{item.label}</ChatDaySeparator>
          ) : (
            <ChatRow
              key={item.key}
              side={item.side}
              tight={item.tight}
              avatar={
                item.side === "incoming" ? (
                  item.showAvatar ? (
                    <ChatAvatar src={counterpartAvatar} />
                  ) : null
                ) : undefined
              }
            >
              <ChatBubble side={item.side}>{item.content}</ChatBubble>
              {item.endsRun && item.createdAt && (
                <ChatMeta>
                  <span className="text-[10px]">
                    {timeFormat.format(item.createdAt)}
                  </span>
                </ChatMeta>
              )}
            </ChatRow>
          ),
        )}
      </ChatThread>

      <div
        className="sticky bottom-0 mt-6 border-t bg-background pt-3"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        {canReply ? (
          <>
            <ChatComposer
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = content.trim();
                if (trimmed) mutation.mutate(trimmed);
              }}
            >
              <ChatComposerInput
                ref={inputRef}
                required
                disabled={mutation.isPending}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                maxLength={MAX_LENGTH}
                placeholder={
                  isReceiver ? "Type your reply…" : "Send another message…"
                }
                aria-label="Your message"
                autoComplete="off"
              />
              <ChatComposerSend
                pending={mutation.isPending}
                disabled={!content.trim()}
              />
            </ChatComposer>
            {content.length >= COUNTER_VISIBLE_AT && (
              <p className="mt-1.5 text-right text-muted-foreground text-xs tabular-nums">
                {remaining} left
              </p>
            )}
          </>
        ) : (
          <p className="flex items-center justify-center gap-2 py-2 text-center text-muted-foreground text-sm">
            <LockIcon className="size-3.5 shrink-0" aria-hidden />
            {isReceiver
              ? "The sender wasn't signed in, so this can't continue."
              : "You can send another message once they reply."}
          </p>
        )}
      </div>
    </div>
  );
}

export function ThreadViewSkeleton() {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 border-b pb-4">
        <Skeleton className="size-10 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-40" />
        </div>
      </div>
      <Skeleton className="mt-5 h-16 w-full rounded-xl" />
      <div className="mt-5 space-y-3">
        <Skeleton className="h-12 w-3/4 rounded-2xl" />
        <Skeleton className="ml-auto h-12 w-2/3 rounded-2xl" />
        <Skeleton className="h-12 w-1/2 rounded-2xl" />
      </div>
    </div>
  );
}
