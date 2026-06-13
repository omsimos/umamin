"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@umamin/ui/components/avatar";
import { Button } from "@umamin/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@umamin/ui/components/dropdown-menu";
import { cn } from "@umamin/ui/lib/utils";
import {
  ArrowLeftIcon,
  Loader2Icon,
  ReplyIcon,
  ScanFaceIcon,
  SendIcon,
  Trash2Icon,
  UsersRoundIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import {
  type KeyboardEventHandler,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import {
  deleteGroupMessageAction,
  markGroupChatReadAction,
  reactToGroupMessageAction,
  sendGroupMessageAction,
} from "@/app/actions/group-chat";
import { GroupBadge } from "@/components/group-badge";
import {
  GROUP_CHAT_REACTION_EMOJIS,
  type GroupAccent,
  type GroupIcon,
} from "@/lib/group";
import { GROUP_ACCENT_CLASSES, GROUP_ICON_MAP } from "@/lib/group-icons";
import {
  infiniteQueryDefaults,
  PRIVATE_STALE_TIME,
  queryKeys,
} from "@/lib/query";
import {
  fetchGroupChatHead,
  fetchGroupChatPage,
  fetchGroupChatReactions,
  fetchGroupChatSince,
} from "@/lib/query-fetchers";
import type {
  GroupChatMessage,
  GroupMessageReactionState,
  GroupPageData,
} from "@/lib/query-types";
import { ReactionsDrawer } from "./reactions-drawer";

// 8s (was 5s): the head poll is the only continuous interval poller and each
// tick is a billed Vercel edge request — 8s trims ~37% of them with minimal
// perceived latency. Keep aligned with HEAD_CACHE_SECONDS in the head route.
const HEAD_POLL_MS = 8000;
const GROUP_MESSAGE_MAX = 1000;
// Cursor for an empty room: "everything since epoch" (bounded) so a brand-new
// room still discovers its first message via the delta path.
const EMPTY_CURSOR = "0.";
const MENTION_SPLIT = /(@[a-z0-9_-]+)/gi;
const MENTION_TEST = /^@[a-z0-9_-]+$/i;

type ChatMessage = GroupChatMessage & { pending?: boolean; failed?: boolean };

function cursorOf(message: GroupChatMessage) {
  return `${new Date(message.createdAt).getTime()}.${message.id}`;
}

function mergeById(prev: ChatMessage[], incoming: ChatMessage[]) {
  const map = new Map(prev.map((m) => [m.id, m]));
  for (const m of incoming) map.set(m.id, m);
  return Array.from(map.values());
}

// Bold @handles in a bubble — works on both bubble colors (no color swap).
function renderBody(content: string) {
  return content.split(MENTION_SPLIT).map((part, i) =>
    MENTION_TEST.test(part) ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: static split, stable order
      <span key={i} className="font-semibold">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

const timeFormat = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

export function GroupChat({
  tag,
  group,
  currentUserId,
  isOwner,
}: {
  tag: string;
  group: GroupPageData;
  currentUserId: string;
  isOwner: boolean;
}) {
  const queryClient = useQueryClient();
  const [live, setLive] = useState<ChatMessage[]>([]);
  const [deletedIds, setDeletedIds] = useState<ReadonlySet<string>>(new Set());
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [draft, setDraft] = useState("");
  const [reactions, setReactions] = useState<
    ReadonlyMap<string, GroupMessageReactionState>
  >(new Map());
  const [reactorsMessageId, setReactorsMessageId] = useState<string | null>(
    null,
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const lastRxnRef = useRef<number | null>(null);
  const loadedIdsRef = useRef<string[]>([]);

  const history = useInfiniteQuery({
    queryKey: queryKeys.groupChat(tag),
    queryFn: ({ pageParam }) =>
      fetchGroupChatPage(tag, (pageParam as string | null) ?? null),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    staleTime: PRIVATE_STALE_TIME,
    ...infiniteQueryDefaults,
  });

  // History pages arrive newest→oldest; flatten + reverse to oldest→newest.
  const historyAsc = useMemo(() => {
    const flat = history.data?.pages.flatMap((p) => p.data) ?? [];
    return [...flat].reverse();
  }, [history.data]);

  // One ordered, de-duped view: history ∪ live, minus optimistically-deleted.
  const messages = useMemo(() => {
    const map = new Map<string, ChatMessage>();
    for (const m of historyAsc) map.set(m.id, m);
    for (const m of live) map.set(m.id, m);
    return Array.from(map.values())
      .filter((m) => !deletedIds.has(m.id))
      .sort((a, b) => {
        const at = new Date(a.createdAt).getTime();
        const bt = new Date(b.createdAt).getTime();
        if (at !== bt) return at - bt;
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      });
  }, [historyAsc, live, deletedIds]);

  // Newest server-backed message (skip optimistic temps — they have no cursor).
  const newestReal = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (!messages[i].pending && !messages[i].failed) return messages[i];
    }
    return undefined;
  }, [messages]);

  const cursorRef = useRef(EMPTY_CURSOR);
  cursorRef.current = newestReal ? cursorOf(newestReal) : EMPTY_CURSOR;
  const newestIdRef = useRef<string | undefined>(undefined);
  newestIdRef.current = newestReal?.id;

  // Server-backed message ids (capped) for bounded reaction refetches.
  loadedIdsRef.current = messages
    .filter((m) => !m.pending && !m.failed)
    .slice(-80)
    .map((m) => m.id);

  const applyReactions = (
    incoming: GroupMessageReactionState[],
    clearIds?: string[],
  ) => {
    setReactions((prev) => {
      const next = new Map(prev);
      if (clearIds) for (const id of clearIds) next.delete(id);
      for (const s of incoming) next.set(s.messageId, s);
      return next;
    });
  };

  const loadReactions = async (ids: string[]) => {
    if (ids.length === 0) return;
    try {
      applyReactions(await fetchGroupChatReactions(tag, ids), ids);
    } catch {
      // Reactions are a best-effort overlay — never surface a fetch error.
    }
  };

  // Poll loop: head-gated delta, paused when the tab is hidden
  // (refetchIntervalInBackground:false). With Redis the head-check is a CDN hit
  // that skips Turso while nothing changed; without it (tail null) we poll the
  // delta directly. Enabled only once the first history page resolved so it
  // doesn't double-fetch the initial load.
  useQuery({
    queryKey: queryKeys.groupChatHead(group.id),
    enabled: history.isSuccess,
    refetchInterval: HEAD_POLL_MS,
    refetchIntervalInBackground: false,
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      const cursor = cursorRef.current;
      const head = await fetchGroupChatHead(tag, group.id);
      const newestMs = Number(cursor.split(".")[0]);

      // New messages: with Redis, skip Turso unless the tail advanced.
      if (head.tail === null || head.tail > newestMs) {
        const delta = await fetchGroupChatSince(tag, cursor);
        if (delta.data.length > 0) {
          setLive((prev) => mergeById(prev, delta.data));
          void loadReactions(delta.data.map((m) => m.id));
        }
      }

      // Reaction changes on already-loaded messages (a reaction doesn't move
      // the tail). Skip the first transition from null — the initial load is
      // handled by the history effect.
      if (head.rxn !== null) {
        if (lastRxnRef.current !== null && head.rxn !== lastRxnRef.current) {
          void loadReactions(loadedIdsRef.current);
        }
        lastRxnRef.current = head.rxn;
      }

      return head;
    },
  });

  // Keep view pinned to the bottom on new messages, but only when the reader is
  // already near it — never yank them up while they're scrolling history.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on count change
  useEffect(() => {
    const el = scrollRef.current;
    if (el && nearBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length]);

  // Load reactions for the loaded window on first load and each "load earlier".
  // biome-ignore lint/correctness/useExhaustiveDependencies: refetch on history growth
  useEffect(() => {
    if (history.isSuccess) {
      void loadReactions(loadedIdsRef.current);
    }
  }, [history.isSuccess, history.data?.pages.length]);

  // Mark read on hide/unmount — never per poll.
  useEffect(() => {
    const fire = () => {
      const lastReadMessageId = newestIdRef.current;
      if (lastReadMessageId) {
        void markGroupChatReadAction({
          groupId: group.id,
          lastReadMessageId,
        }).then(() => {
          // Clear the hub dot once they've opened + left the room.
          queryClient.invalidateQueries({ queryKey: queryKeys.groupUnread() });
        });
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") fire();
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      fire();
    };
  }, [group.id, queryClient]);

  const sendMutation = useMutation({
    mutationFn: async (vars: {
      content: string;
      replyToMessageId?: string;
    }) => {
      const res = await sendGroupMessageAction({
        groupId: group.id,
        content: vars.content,
        replyToMessageId: vars.replyToMessageId,
      });
      if (res && "error" in res && res.error) {
        throw new Error(res.error);
      }
      return res as { success: true; id: string; createdAt: string | Date };
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const res = await deleteGroupMessageAction({
        groupId: group.id,
        messageId,
      });
      if (res && "error" in res && res.error) {
        throw new Error(res.error);
      }
    },
    onMutate: (messageId) => {
      setDeletedIds((prev) => new Set(prev).add(messageId));
    },
    onError: (err, messageId) => {
      setDeletedIds((prev) => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
      toast.error(err instanceof Error ? err.message : "Couldn't delete.");
    },
  });

  const reactMutation = useMutation({
    mutationFn: async (vars: { messageId: string; emoji: string }) => {
      const res = await reactToGroupMessageAction({
        groupId: group.id,
        messageId: vars.messageId,
        emoji: vars.emoji,
      });
      if (res && "error" in res && res.error) {
        throw new Error(res.error);
      }
    },
  });

  // Optimistically toggle/replace the viewer's reaction, then reconcile counts
  // from the server. Tapping your current emoji removes it.
  const onReact = (messageId: string, emoji: string) => {
    const current = reactions.get(messageId)?.viewerReaction ?? null;
    const nextEmoji = current === emoji ? null : emoji;

    setReactions((prev) => {
      const next = new Map(prev);
      const cur = next.get(messageId) ?? {
        messageId,
        reactions: [],
        viewerReaction: null,
      };
      const counts = new Map(cur.reactions.map((r) => [r.emoji, r.count]));
      if (current)
        counts.set(current, Math.max(0, (counts.get(current) ?? 1) - 1));
      if (nextEmoji) counts.set(nextEmoji, (counts.get(nextEmoji) ?? 0) + 1);
      next.set(messageId, {
        messageId,
        reactions: Array.from(counts, ([e, count]) => ({
          emoji: e,
          count,
        })).filter((r) => r.count > 0),
        viewerReaction: nextEmoji,
      });
      return next;
    });

    reactMutation.mutate(
      { messageId, emoji },
      {
        onSettled: () => void loadReactions([messageId]),
        onError: () => toast.error("Couldn't react."),
      },
    );
  };

  // Fire the send for an already-optimistic message (temp id). On success we
  // silently swap in the real id/time; on failure the bubble flips to a
  // "failed" state in place (with retry) — never a disruptive disappear, and
  // never a blocking "sending" spinner.
  const submitMessage = (
    tempId: string,
    content: string,
    replyToMessageId: string | null,
  ) => {
    sendMutation.mutate(
      { content, replyToMessageId: replyToMessageId ?? undefined },
      {
        onSuccess: (res) =>
          setLive((prev) =>
            prev.map((m) =>
              m.id === tempId
                ? {
                    ...m,
                    id: res.id,
                    createdAt: new Date(res.createdAt),
                    pending: false,
                    failed: false,
                  }
                : m,
            ),
          ),
        onError: () =>
          setLive((prev) =>
            prev.map((m) =>
              m.id === tempId ? { ...m, pending: false, failed: true } : m,
            ),
          ),
      },
    );
  };

  const send = () => {
    const content = draft.trim();
    if (!content) return;

    const parent = replyingTo;
    // Unique even for sends fired within the same millisecond.
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const optimistic: ChatMessage = {
      id: tempId,
      content,
      createdAt: new Date(),
      sender: {
        id: currentUserId,
        username: "",
        displayName: null,
        imageUrl: null,
        equippedGroupId: null,
        groupBadge: null,
      },
      replyTo: parent
        ? {
            id: parent.id,
            content: parent.content,
            senderName:
              parent.sender.displayName ?? parent.sender.username ?? "",
          }
        : null,
      pending: true,
    };

    setLive((prev) => [...prev, optimistic]);
    setDraft("");
    setReplyingTo(null);
    nearBottomRef.current = true;

    submitMessage(tempId, content, parent?.id ?? null);
  };

  const retrySend = (message: ChatMessage) => {
    setLive((prev) =>
      prev.map((m) =>
        m.id === message.id ? { ...m, pending: true, failed: false } : m,
      ),
    );
    submitMessage(message.id, message.content, message.replyTo?.id ?? null);
  };

  const onKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    nearBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  const GroupIconGlyph =
    GROUP_ICON_MAP[group.icon as GroupIcon] ?? UsersRoundIcon;
  const groupAccentClass =
    group.accent && group.accent in GROUP_ACCENT_CLASSES
      ? GROUP_ACCENT_CLASSES[group.accent as GroupAccent]
      : "text-muted-foreground";

  return (
    // Full-screen immersive thread (covers the app's top header + bottom nav)
    // so the composer is always visible and pinned, like a mobile messenger.
    <div className="fixed inset-0 z-50 bg-background">
      <div className="mx-auto flex h-full w-full flex-col lg:max-w-2xl lg:border-x">
        <header
          className="flex shrink-0 items-center gap-2 border-b px-2 pb-2"
          style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
        >
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back to group"
            asChild
          >
            <Link href={`/groups/${tag}`}>
              <ArrowLeftIcon className="size-5" />
            </Link>
          </Button>
          <Link
            href={`/groups/${tag}`}
            className="flex min-w-0 flex-1 items-center gap-2"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
              <GroupIconGlyph className={cn("size-5", groupAccentClass)} />
            </div>
            <p className="min-w-0 flex-1 truncate text-sm font-semibold">
              {group.name}
            </p>
          </Link>
        </header>

        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="flex-1 overflow-y-auto px-2 py-4"
        >
          {history.hasNextPage && (
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                disabled={history.isFetchingNextPage}
                onClick={() => history.fetchNextPage()}
              >
                {history.isFetchingNextPage ? (
                  <Loader2Icon className="animate-spin" />
                ) : (
                  "Load earlier messages"
                )}
              </Button>
            </div>
          )}

          {history.isLoading ? (
            <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" /> Loading messages…
            </p>
          ) : messages.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No messages yet. Say hello 👋
            </p>
          ) : null}

          {messages.map((message, i) => {
            const isOwn = message.sender.id === currentUserId;
            const canDelete = isOwn || isOwner;
            const rxn = reactions.get(message.id);
            const hasReactions = !!rxn && rxn.reactions.length > 0;
            // Group consecutive messages from the same sender: the name + badge
            // + time header sits once at the top of a run; the avatar sits once
            // at the bottom, aligned with the last bubble (Messenger-style).
            const prev = messages[i - 1];
            const next = messages[i + 1];
            const firstOfGroup = !prev || prev.sender.id !== message.sender.id;
            const lastOfGroup = !next || next.sender.id !== message.sender.id;
            const bubbleClass = cn(
              "rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words",
              isOwn ? "bg-primary text-primary-foreground" : "bg-muted",
            );
            return (
              <div
                key={message.id}
                className={cn(
                  "flex items-end gap-2",
                  isOwn ? "flex-row-reverse" : "flex-row",
                  i > 0 && (firstOfGroup ? "mt-3" : "mt-0.5"),
                )}
              >
                {!isOwn &&
                  (lastOfGroup ? (
                    <Link
                      href={`/user/${message.sender.username}`}
                      className="shrink-0"
                    >
                      <Avatar className="size-8">
                        <AvatarImage
                          src={message.sender.imageUrl ?? ""}
                          alt=""
                        />
                        <AvatarFallback>
                          <ScanFaceIcon className="size-4" />
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                  ) : (
                    <div className="w-8 shrink-0" aria-hidden />
                  ))}

                <div
                  className={cn(
                    "flex max-w-[78%] flex-col gap-0.5",
                    isOwn ? "items-end" : "items-start",
                  )}
                >
                  {!isOwn && firstOfGroup && (
                    <div className="flex min-w-0 items-center gap-1.5 pb-0.5">
                      <span className="truncate text-xs font-medium">
                        {message.sender.displayName ?? message.sender.username}
                      </span>
                      <GroupBadge badge={message.sender.groupBadge} />
                      <span className="shrink-0 text-[10px] whitespace-nowrap text-muted-foreground">
                        {timeFormat.format(new Date(message.createdAt))}
                      </span>
                    </div>
                  )}

                  {message.replyTo && (
                    <div
                      className={cn(
                        "max-w-full rounded-md border-l-2 border-muted-foreground/40 bg-muted/50 px-2 py-1 text-xs text-muted-foreground",
                        isOwn ? "text-right" : "text-left",
                      )}
                    >
                      <span className="font-medium">
                        {message.replyTo.senderName}
                      </span>
                      <span className="ml-1 line-clamp-1 inline">
                        {message.replyTo.content}
                      </span>
                    </div>
                  )}

                  {/* Bubble + the floating reactions chip share a relative box
                      so the chip sits on the bubble's bottom edge (inner side).
                      Tapping a sent bubble opens reactions + actions; tapping the
                      chip opens the who-reacted drawer (it never toggles —
                      removal is re-picking the same emoji). */}
                  <div className={cn("relative", hasReactions && "mb-3")}>
                    {message.pending || message.failed ? (
                      <div
                        className={cn(
                          bubbleClass,
                          message.failed && "opacity-70",
                        )}
                      >
                        {renderBody(message.content)}
                      </div>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className={cn(
                              bubbleClass,
                              "max-w-full text-left transition active:opacity-80",
                            )}
                          >
                            {renderBody(message.content)}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align={isOwn ? "end" : "start"}
                          className="w-auto min-w-44"
                        >
                          <div className="flex gap-0.5 p-1">
                            {GROUP_CHAT_REACTION_EMOJIS.map((emoji) => (
                              <DropdownMenuItem
                                key={emoji}
                                onSelect={() => onReact(message.id, emoji)}
                                aria-label={`React with ${emoji}`}
                                className={cn(
                                  "size-10 justify-center rounded-full p-0 text-xl",
                                  rxn?.viewerReaction === emoji && "bg-accent",
                                )}
                              >
                                {emoji}
                              </DropdownMenuItem>
                            ))}
                          </div>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onSelect={() => setReplyingTo(message)}
                          >
                            <ReplyIcon /> Reply
                          </DropdownMenuItem>
                          {canDelete && (
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => deleteMutation.mutate(message.id)}
                            >
                              <Trash2Icon /> Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}

                    {rxn && rxn.reactions.length > 0 && (
                      <button
                        type="button"
                        aria-label="See who reacted"
                        onClick={() => setReactorsMessageId(message.id)}
                        className={cn(
                          "absolute -bottom-3 flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-sm leading-none shadow-sm transition-transform active:scale-95",
                          isOwn ? "left-2" : "right-2",
                        )}
                      >
                        {rxn.reactions.map((r) => (
                          <span
                            key={r.emoji}
                            className="flex items-center gap-0.5"
                          >
                            {r.emoji}
                            {r.count > 1 && (
                              <span className="text-xs font-medium tabular-nums text-muted-foreground">
                                {r.count}
                              </span>
                            )}
                          </span>
                        ))}
                      </button>
                    )}
                  </div>

                  {message.failed ? (
                    <button
                      type="button"
                      onClick={() => retrySend(message)}
                      className="px-1 text-[10px] font-medium text-destructive"
                    >
                      Not delivered · Tap to retry
                    </button>
                  ) : (
                    // Other-user time lives in the header row; own messages
                    // (no header) show it under the last bubble of a run.
                    isOwn &&
                    lastOfGroup && (
                      <span className="px-1 text-[10px] text-muted-foreground">
                        {timeFormat.format(new Date(message.createdAt))}
                      </span>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {replyingTo && (
          <div className="flex shrink-0 items-center gap-2 border-t px-2 pt-2 text-xs text-muted-foreground">
            <ReplyIcon className="size-3.5 shrink-0" />
            <span className="min-w-0 flex-1 truncate">
              Replying to{" "}
              <span className="font-medium">
                {replyingTo.sender.displayName ??
                  replyingTo.sender.username ??
                  "message"}
              </span>
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              aria-label="Cancel reply"
              onClick={() => setReplyingTo(null)}
            >
              <XIcon className="size-3.5" />
            </Button>
          </div>
        )}

        <form
          className="flex shrink-0 items-end gap-2 border-t px-2 pt-3"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            maxLength={GROUP_MESSAGE_MAX}
            placeholder="Message…"
            className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border bg-muted/40 px-4 py-2.5 text-sm focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
          />
          <Button
            type="submit"
            size="icon"
            className="size-11 shrink-0 rounded-full"
            aria-label="Send message"
            disabled={!draft.trim()}
          >
            <SendIcon className="size-4" />
          </Button>
        </form>
      </div>

      <ReactionsDrawer
        tag={tag}
        messageId={reactorsMessageId}
        currentUserId={currentUserId}
        onClose={() => setReactorsMessageId(null)}
      />
    </div>
  );
}
