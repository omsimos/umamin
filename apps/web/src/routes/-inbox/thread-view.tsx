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
import type { KeyboardEventHandler } from "react";
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

// Placeholder id for the optimistically appended bubble; swapped for the
// server row on success. Single-flight sends mean at most one exists.
const OPTIMISTIC_ID = "optimistic-send";

const timeFormat = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

// Envelope errors carry user-facing copy ("You can reply once they respond",
// the rate-limit message); network failures don't — the toast branches on it.
class ActionError extends Error {}

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
  const threadKey = queryKeys.messageThread(messageId);
  const [content, setContent] = useState("");
  // Timeline key of the in-flight optimistic bubble (pending style).
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const inputRef = useDynamicTextarea(content);
  const submitReply = useSingleFlightAction(createReplyAction);
  const markedRef = useRef(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const seenCountRef = useRef<number | null>(null);

  const { data, isError } = useQuery({
    queryKey: threadKey,
    queryFn: () => fetchMessageThread(messageId),
    staleTime: PRIVATE_STALE_TIME,
    // Deliberately fresher than privateQueryDefaults: this is a conversation,
    // so coming back to the tab should pick up the other side's reply.
    refetchOnWindowFocus: true,
  });

  // Keep the newest message in view: jump there on open (long threads land at
  // the top otherwise) and follow as new messages append. When the page
  // already fits the viewport this is a no-op.
  useEffect(() => {
    if (!data) return;
    const count = data.replies.length + (data.message.reply ? 1 : 0);
    const previous = seenCountRef.current;
    seenCountRef.current = count;
    // Growth only — an error rollback shrinks the list and must not scroll.
    if (count === 0 || (previous !== null && count <= previous)) return;
    const initial = previous === null;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    endRef.current?.scrollIntoView({
      behavior: initial || reduceMotion ? "instant" : "smooth",
      block: "end",
    });
  }, [data]);

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
        throw new ActionError(res.error);
      }
      return res;
    },
    // Append the bubble before the round trip (Tokyo RTs make a post-response
    // append feel laggy); the input clears immediately and stays enabled.
    onMutate: (text) => {
      const current =
        queryClient.getQueryData<MessageThreadResponse>(threadKey);
      // The receiver's first reply lands on the legacy column, not a row.
      const legacy =
        current?.viewerRole === "receiver" && !current.message.reply;

      if (current) {
        queryClient.setQueryData<MessageThreadResponse>(
          threadKey,
          legacy
            ? { ...current, message: { ...current.message, reply: text } }
            : {
                ...current,
                replies: [
                  ...current.replies,
                  {
                    id: OPTIMISTIC_ID,
                    content: text,
                    fromSender: current.viewerRole === "sender",
                    createdAt: new Date(),
                  },
                ],
              },
        );
      }

      setPendingKey(legacy ? "legacy-reply" : OPTIMISTIC_ID);
      setContent("");
      return { legacy };
    },
    onSuccess: (res) => {
      queryClient.setQueryData<MessageThreadResponse>(threadKey, (current) => {
        if (!current) return current;
        if ("entry" in res && res.entry) {
          const entry = {
            ...res.entry,
            createdAt: new Date(res.entry.createdAt),
          };
          // Filter both ids: a focus refetch mid-flight may already carry the
          // real row, and the optimistic one must not survive either way.
          const replies = current.replies.filter(
            (r) => r.id !== OPTIMISTIC_ID && r.id !== entry.id,
          );
          return { ...current, replies: [...replies, entry] };
        }
        if ("reply" in res && res.reply) {
          return {
            ...current,
            message: { ...current.message, reply: res.reply },
          };
        }
        // Bare success = the server silently dropped it (blocked words);
        // remove the ghost so the cache matches what the server stored.
        return {
          ...current,
          replies: current.replies.filter((r) => r.id !== OPTIMISTIC_ID),
        };
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.receivedMessages(),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.sentMessages(),
      });
    },
    onError: (err, text, ctx) => {
      console.error(err);
      // Take the optimistic bubble back out and hand the draft back.
      queryClient.setQueryData<MessageThreadResponse>(threadKey, (current) => {
        if (!current) return current;
        return ctx?.legacy
          ? { ...current, message: { ...current.message, reply: null } }
          : {
              ...current,
              replies: current.replies.filter((r) => r.id !== OPTIMISTIC_ID),
            };
      });
      setContent(text);
      toast.error(
        err instanceof ActionError ? err.message : "Couldn't send reply.",
      );
    },
    onSettled: () => {
      setPendingKey(null);
    },
  });

  const submit = () => {
    if (mutation.isPending) return;
    const trimmed = content.trim();
    if (trimmed) mutation.mutate(trimmed);
  };

  const onComposerKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

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
          {isReceiver ? "You asked" : "They asked"}
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
              <ChatBubble
                side={item.side}
                state={item.key === pendingKey ? "pending" : "idle"}
              >
                {item.content}
              </ChatBubble>
              {item.endsRun && item.createdAt && (
                <ChatMeta>
                  <span
                    className="text-[10px]"
                    title={item.createdAt.toLocaleString()}
                  >
                    {timeFormat.format(item.createdAt)}
                  </span>
                </ChatMeta>
              )}
            </ChatRow>
          ),
        )}
      </ChatThread>

      {/* Deliberately in flow, not sticky: the mobile Menubar is fixed over
          the viewport bottom, so a sticky composer would sit under it. */}
      <div className="mt-6 border-t pt-4">
        {canReply ? (
          <>
            <ChatComposer
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              {/* Never disabled while sending: the append is optimistic, and
                  disabling would drop focus (closing the mobile keyboard). */}
              <ChatComposerInput
                ref={inputRef}
                required
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={onComposerKeyDown}
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

      {/* Scroll target: sits below the composer so following the newest
          message keeps the input on screen too. */}
      <div ref={endRef} aria-hidden />
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
