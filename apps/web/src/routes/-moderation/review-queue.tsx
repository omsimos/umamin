import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { callAction } from "@/lib/api";
import { ExpectedError } from "@/lib/expected-error";
import { Link } from "@/lib/navigation";
import type { ReviewItem, ReviewKind, ReviewPage } from "@/lib/types";
import { getActionError } from "@/lib/utils";
import {
  deleteCommentAction,
  deletePostAction,
  removeNoteAction,
} from "../_social/-lib/actions";

type QueueKind = "severe" | "drama";

const queryKey = (kind: QueueKind) => ["moderation", "review", kind] as const;

async function fetchReview(kind: QueueKind): Promise<ReviewPage> {
  const res = await fetch(`/api/moderation/review?kind=${kind}`, {
    credentials: "include",
  });
  const data = (await res.json()) as ReviewPage & { error?: string };
  if (!res.ok || data.error) {
    throw new Error(data.error ?? "Failed to load the review queue");
  }
  return data;
}

function clearContentFlagAction(input: { kind: ReviewKind; id: string }) {
  return callAction<{ success?: boolean }>("clearContentFlagAction", input);
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
          Content the classifier scored as possibly severe. Clear a flag when
          it's wrong; remove content that breaks the rules.
        </p>
        <ReviewList kind="severe" />
      </TabsContent>
      <TabsContent value="drama" className="mt-4 space-y-3">
        <p className="text-xs text-muted-foreground">
          Recent content with a drama score of 50 or more, for checking where
          the hide threshold should sit. Nothing here is acted on automatically.
        </p>
        <ReviewList kind="drama" />
      </TabsContent>
    </Tabs>
  );
}

function ReviewList({ kind }: { kind: QueueKind }) {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: queryKey(kind),
    queryFn: () => fetchReview(kind),
  });

  const settle = (item: ReviewItem) =>
    queryClient.setQueryData<ReviewPage>(queryKey(kind), (current) =>
      current
        ? {
            ...current,
            data: current.data.filter(
              (row) => !(row.kind === item.kind && row.id === item.id),
            ),
          }
        : current,
    );

  const clearMutation = useMutation({
    mutationFn: async (item: ReviewItem) => {
      const error = getActionError(
        await clearContentFlagAction({ kind: item.kind, id: item.id }),
      );
      if (error) throw new ExpectedError(error);
      return item;
    },
    onSuccess: (item) => {
      settle(item);
      toast.success("Flag cleared.");
    },
    onError: () => toast.error("Couldn't clear the flag."),
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
  if (error) {
    return (
      <p className="text-sm text-muted-foreground">
        Couldn't load the queue. Try again later.
      </p>
    );
  }
  if (!data?.data.length) {
    return <p className="text-sm text-muted-foreground">Nothing to review.</p>;
  }

  const busy = (item: ReviewItem) =>
    (clearMutation.isPending && clearMutation.variables?.id === item.id) ||
    (removeMutation.isPending && removeMutation.variables?.id === item.id);

  return (
    <ul className="divide-y rounded-lg border">
      {data.data.map((item) => (
        <li key={`${item.kind}:${item.id}`} className="space-y-2 p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">{item.kind}</Badge>
            {item.reason && <Badge variant="outline">{item.reason}</Badge>}
            <span>
              severe {item.severe ?? "–"} · drama {item.drama ?? "–"}
            </span>
            <span className="truncate">
              {item.author ? `@${item.author.username}` : "anonymous"}
            </span>
          </div>
          <p className="whitespace-pre-wrap break-words text-sm">
            {item.content}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="ghost">
              <Link href={contentHref(item)}>Open</Link>
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy(item)}
              onClick={() => clearMutation.mutate(item)}
            >
              Clear flag
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={busy(item)}
              onClick={() => removeMutation.mutate(item)}
            >
              Remove
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
