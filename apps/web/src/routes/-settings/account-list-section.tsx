import type { InfiniteData } from "@tanstack/react-query";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { Avatar, AvatarImage } from "@umamin/ui/components/avatar";
import { Button } from "@umamin/ui/components/button";
import { Label } from "@umamin/ui/components/label";
import { Skeleton } from "@umamin/ui/components/skeleton";
import { toast } from "sonner";
import { BlobatarFallback } from "@/components/blobatar-fallback";
import { TimeAgoVerbose } from "@/components/time-ago-verbose";
import { ExpectedError } from "@/lib/expected-error";
import { Link } from "@/lib/navigation";
import {
  infiniteQueryDefaults,
  PRIVATE_STALE_TIME,
  queryKeys,
} from "@/lib/query";
import type { CursorPage, FeedAuthor } from "@/lib/types";

type ListedAccount = FeedAuthor & { listedAt: Date };

// Shared by the Blocked and Muted settings lists: same paging, row layout and
// optimistic removal, differing only in data source, action and copy.
export function AccountListSection<T extends FeedAuthor>({
  label,
  queryKey,
  fetchPage,
  toListed,
  remove,
  removeLabel,
  pastTense,
  emptyText,
  onRemoved,
}: {
  label: string;
  queryKey: readonly unknown[];
  fetchPage: (cursor: string | null) => Promise<CursorPage<T>>;
  toListed: (account: T) => ListedAccount;
  remove: (input: { userId: string }) => Promise<unknown>;
  removeLabel: string;
  pastTense: string;
  emptyText: string;
  onRemoved: (account: { id: string; username: string }) => void;
}) {
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<CursorPage<T>>({
    queryKey,
    queryFn: ({ pageParam }) => fetchPage((pageParam as string | null) ?? null),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: PRIVATE_STALE_TIME,
    ...infiniteQueryDefaults,
  });

  const removeMutation = useMutation({
    mutationFn: async (user: { id: string; username: string }) => {
      const res = await remove({ userId: user.id });
      if (res && typeof res === "object" && "error" in res && res.error) {
        throw new ExpectedError(String(res.error));
      }
      return user;
    },
    onSuccess: (user) => {
      queryClient.setQueryData<InfiniteData<CursorPage<T>>>(
        queryKey,
        (current) =>
          current && {
            ...current,
            pages: current.pages.map((page) => ({
              ...page,
              data: page.data.filter((account) => account.id !== user.id),
            })),
          },
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.postsRoot() });
      queryClient.invalidateQueries({ queryKey: queryKeys.notesRoot() });
      onRemoved(user);
    },
    onError: (err) => {
      console.error(err);
      toast.error(`Couldn't ${removeLabel.toLowerCase()} user.`);
    },
  });

  const accounts = data?.pages.flatMap((page) => page.data.map(toListed)) ?? [];

  return (
    <section>
      <Label>{label}</Label>
      <div className="space-y-4 rounded-md border p-4 mt-2">
        {error ? (
          <p className="text-sm text-muted-foreground">
            Failed to load this list. Please try again later.
          </p>
        ) : isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : accounts.length === 0 && !hasNextPage ? (
          <p className="text-sm text-muted-foreground italic">{emptyText}</p>
        ) : (
          <ul className="divide-y">
            {accounts.map((user) => (
              <li
                key={user.id}
                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <Link href={`/user/${user.username}`}>
                  <Avatar>
                    <AvatarImage
                      className="rounded-full"
                      src={user.imageUrl ?? ""}
                      alt={`@${user.username}'s avatar`}
                    />
                    <BlobatarFallback seed={user.id} />
                  </Avatar>
                </Link>

                <div className="flex-1 min-w-0">
                  <Link
                    href={`/user/${user.username}`}
                    className="text-sm font-medium leading-none block truncate"
                  >
                    {user.displayName || user.username}
                  </Link>
                  <p className="text-xs text-muted-foreground truncate">
                    @{user.username} · {pastTense}{" "}
                    <TimeAgoVerbose date={user.listedAt} />
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={
                    removeMutation.isPending &&
                    removeMutation.variables?.id === user.id
                  }
                  onClick={() =>
                    removeMutation.mutate({
                      id: user.id,
                      username: user.username,
                    })
                  }
                >
                  {removeLabel}
                </Button>
              </li>
            ))}
          </ul>
        )}

        {hasNextPage && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? "Loading…" : "Load more"}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
