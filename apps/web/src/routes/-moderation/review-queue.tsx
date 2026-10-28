import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { Badge } from "@umamin/ui/components/badge";
import { Button } from "@umamin/ui/components/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@umamin/ui/components/tabs";
import { useState } from "react";
import { toast } from "sonner";
import { RefetchErrorAlert } from "@/components/refetch-error-alert";
import { TimeAgo } from "@/components/time-ago";
import { callAction } from "@/lib/api";
import { ExpectedError } from "@/lib/expected-error";
import { Link } from "@/lib/navigation";
import type { ReviewItem, ReviewPage } from "@/lib/types";
import { getActionError } from "@/lib/utils";
import {
  deleteCommentAction,
  deletePostAction,
  removeNoteAction,
} from "../_social/-lib/actions";

type QueueKind = "severe" | "drama";

const queryKey = (kind: QueueKind) => ["moderation", "review", kind] as const;

async function fetchReview(
  kind: QueueKind,
  cursor: string | null,
): Promise<ReviewPage> {
  const params = new URLSearchParams({ kind });
  if (cursor) params.set("cursor", cursor);
  const res = await fetch(`/api/moderation/review?${params}`, {
    credentials: "include",
  });
  const data = (await res.json()) as ReviewPage & { error?: string };
  if (!res.ok || data.error) {
    throw new Error(data.error ?? "Failed to load the review queue");
  }
  return data;
}

type Decision = "clear" | "keep";

function decideAction(decision: Decision, item: ReviewItem) {
  return callAction<{ success?: boolean }>(
    decision === "clear" ? "clearContentFlagAction" : "keepContentFlagAction",
    { kind: item.kind, id: item.id },
  );
}

function removeContent(item: ReviewItem) {
  if (item.kind === "post") return deletePostAction({ postId: item.id });
  if (item.kind === "comment")
    return deleteCommentAction({ commentId: item.id });
  return removeNoteAction({ noteId: item.id });
}

function contentHref(item: ReviewItem) {
  if (item.kind === "post") return `/post/${item.id}`;
  if (item.kind === "comment" && item.postId) return `/post/${item.postId}`;
  return "/notes";
}

export function ReviewQueue() {
  const [kind, setKind] = useState<QueueKind>("severe");

  return (
    <Tabs value={kind} onValueChange={(value) => setKind(value as QueueKind)}>
      <TabsList className="w-full">
        <TabsTrigger value="severe" className="flex-1">
          Flagged
        </TabsTrigger>
        <TabsTrigger value="drama" className="flex-1">
          Drama check
        </TabsTrigger>
      </TabsList>
      <TabsContent value="severe" className="mt-4 space-y-3">
        <p className="text-xs text-muted-foreground">
          Flagged by a high severe score, by its author asking for review, or by
          viewers saying Uma got it wrong. Uncover a label that's wrong, keep
          one that's right, and remove content that breaks the rules.
        </p>
        <ReviewList kind="severe" />
      </TabsContent>
      <TabsContent value="drama" className="mt-4 space-y-3">
        <p className="text-xs text-muted-foreground">
          Recent content with a drama score of 50 or more, for checking where
          the fold line should sit. Rows marked Folded are folded right now for
          viewers who hide disputes.
        </p>
        <ReviewList kind="drama" />
      </TabsContent>
    </Tabs>
  );
}

const decisionToast: Record<Decision, string> = {
  clear: "Uncovered.",
  keep: "Kept as is.",
};

function ReviewList({ kind }: { kind: QueueKind }) {
  const queryClient = useQueryClient();
  // Removal is permanent, so it takes a second tap on the same row.
  const [confirming, setConfirming] = useState<string | null>(null);
  const {
    data,
    isLoading,
    error,
    hasNextPage,
    fetchNextPage,
    isFetching,
    isFetchingNextPage,
    isFetchNextPageError,
    refetch,
  } = useInfiniteQuery({
    queryKey: queryKey(kind),
    queryFn: ({ pageParam }) => fetchReview(kind, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });

  const settle = (item: ReviewItem) =>
    queryClient.setQueryData<InfiniteData<ReviewPage, string | null>>(
      queryKey(kind),
      (current) =>
        current && {
          ...current,
          pages: current.pages.map((page) => ({
            ...page,
            data: page.data.filter(
              (row) => !(row.kind === item.kind && row.id === item.id),
            ),
          })),
        },
    );

  const decideMutation = useMutation({
    mutationFn: async ({
      decision,
      item,
    }: {
      decision: Decision;
      item: ReviewItem;
    }) => {
      const error = getActionError(await decideAction(decision, item));
      if (error) throw new ExpectedError(error);
      return { decision, item };
    },
    onSuccess: ({ decision, item }) => {
      settle(item);
      toast.success(decisionToast[decision]);
    },
    onError: () => toast.error("Couldn't save that. Try again."),
  });

  const removeMutation = useMutation({
    mutationFn: async (item: ReviewItem) => {
      const error = getActionError(await removeContent(item));
      if (error) throw new ExpectedError(error);
      return item;
    },
    onSuccess: (item) => {
      settle(item);
      toast.success("Removed.");
    },
    onError: () => toast.error("Couldn't remove it."),
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (error && !data) {
    return (
      <p className="text-sm text-muted-foreground">
        Couldn't load the queue. Try again later.
      </p>
    );
  }
  const items = data?.pages.flatMap((page) => page.data) ?? [];
  if (!items.length) {
    return <p className="text-sm text-muted-foreground">Nothing to review.</p>;
  }

  const busy = (item: ReviewItem) =>
    (decideMutation.isPending &&
      decideMutation.variables?.item.id === item.id) ||
    (removeMutation.isPending && removeMutation.variables?.id === item.id);

  return (
    <>
      {error && (
        <RefetchErrorAlert
          onRetry={() => (isFetchNextPageError ? fetchNextPage() : refetch())}
          retrying={isFetching}
        />
      )}
      <ul className="divide-y rounded-lg border">
        {items.map((item) => {
          const key = `${item.kind}:${item.id}`;
          return (
            <li key={key} className="space-y-2 p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">{item.kind}</Badge>
                <LabelBadge item={item} />
                {item.reason && <Badge variant="outline">{item.reason}</Badge>}
                {item.appealed && <Badge variant="outline">author asked</Badge>}
                {item.disputes > 0 && (
                  <Badge variant="outline">
                    {item.disputes === 1
                      ? "1 viewer disagrees"
                      : `${item.disputes} viewers disagree`}
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                <span>
                  severe {item.severe ?? "–"} · drama {item.drama ?? "–"}
                </span>
                <span className="truncate">
                  {item.author ? `@${item.author.username}` : "anonymous"}
                </span>
                <TimeAgo date={item.createdAt} />
              </div>
              {item.context && (
                <p className="line-clamp-3 whitespace-pre-wrap break-words border-l-2 pl-2 text-xs text-muted-foreground">
                  <span className="font-medium">
                    {item.kind === "comment" ? "Replying to: " : "Quoting: "}
                  </span>
                  {item.context}
                </p>
              )}
              <p className="whitespace-pre-wrap break-words text-sm">
                {item.content}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="ghost">
                  <Link href={contentHref(item)}>Open</Link>
                </Button>
                {item.label && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy(item)}
                    onClick={() =>
                      decideMutation.mutate({ decision: "clear", item })
                    }
                  >
                    Uncover
                  </Button>
                )}
                {kind === "severe" && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy(item)}
                    onClick={() =>
                      decideMutation.mutate({ decision: "keep", item })
                    }
                  >
                    {item.label ? "Keep" : "Dismiss"}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy(item)}
                  onClick={() => {
                    if (confirming === key) {
                      setConfirming(null);
                      removeMutation.mutate(item);
                    } else {
                      setConfirming(key);
                    }
                  }}
                >
                  {confirming === key ? "Tap again to remove" : "Remove"}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      {hasNextPage && (
        <Button
          variant="outline"
          className="w-full"
          disabled={isFetchingNextPage}
          onClick={() => fetchNextPage()}
        >
          {isFetchingNextPage ? "Loading…" : "Load more"}
        </Button>
      )}
    </>
  );
}

function LabelBadge({ item }: { item: ReviewItem }) {
  if (item.label === "severe") return <Badge>Covered</Badge>;
  if (item.label === "scam") return <Badge>Covered: scam</Badge>;
  if (item.label === "drama") return <Badge>Folded</Badge>;
  return <Badge variant="outline">Not covered</Badge>;
}
