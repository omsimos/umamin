import type { InfiniteData } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createPostAction } from "@/app/actions/post";
import { useSingleFlightAction } from "@/hooks/use-single-flight-action";
import { queryKeys } from "@/lib/query";
import { prependFeedItem, replaceFeedItem } from "@/lib/query-cache";
import type { FeedResponse } from "@/lib/query-types";
import type { FeedItem, PostData } from "@/types/post";
import type { PublicUser } from "@/types/user";

function isNonFollowingFeedQuery(queryKey: readonly unknown[]) {
  return queryKey[0] === "posts" && queryKey[1] !== "following";
}

export function useCreatePost(user: PublicUser | null) {
  const queryClient = useQueryClient();
  const submit = useSingleFlightAction(createPostAction);

  const mutation = useMutation({
    mutationFn: async (nextContent: string) => {
      const res = await submit({ content: nextContent });
      if (res?.error) {
        throw new Error(res.error);
      }
      return res;
    },
    onMutate: async (nextContent) => {
      if (!user) return {};
      await queryClient.cancelQueries({ queryKey: queryKeys.postsRoot() });

      const previous = queryClient.getQueriesData<InfiniteData<FeedResponse>>({
        queryKey: queryKeys.postsRoot(),
      });

      const optimisticPost: PostData = {
        id: `optimistic-${crypto.randomUUID()}`,
        content: nextContent,
        authorId: user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
        likeCount: 0,
        commentCount: 0,
        repostCount: 0,
        author: user,
        isLiked: false,
        isReposted: false,
      };
      const optimistic: FeedItem = { type: "post", post: optimisticPost };

      queryClient.setQueriesData<InfiniteData<FeedResponse>>(
        {
          queryKey: queryKeys.postsRoot(),
          predicate: (query) => isNonFollowingFeedQuery(query.queryKey),
        },
        (current) => prependFeedItem(current, optimistic),
      );

      return { previous, optimisticId: optimisticPost.id };
    },
    onError: (err, _vars, ctx) => {
      for (const [queryKey, previous] of ctx?.previous ?? []) {
        queryClient.setQueryData(queryKey, previous);
      }
      toast.error(err.message ?? "Couldn't post.");
    },
    onSuccess: (res, _vars, ctx) => {
      if (res?.error) {
        toast.error(res.error);
        return;
      }

      if (user && res?.post && ctx?.optimisticId) {
        const nextItem: FeedItem = {
          type: "post",
          post: {
            ...res.post,
            author: user,
            isLiked: false,
            isReposted: false,
          },
        };

        queryClient.setQueriesData<InfiniteData<FeedResponse>>(
          {
            queryKey: queryKeys.postsRoot(),
            predicate: (query) => isNonFollowingFeedQuery(query.queryKey),
          },
          (previous) =>
            replaceFeedItem(
              previous,
              (item) =>
                item.type === "post" && item.post.id === ctx.optimisticId,
              nextItem,
            ),
        );
      }

      toast.success("Post published.");
    },
  });

  return { submitPost: mutation.mutateAsync, isPending: mutation.isPending };
}
