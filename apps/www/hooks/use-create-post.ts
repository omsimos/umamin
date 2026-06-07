import type { InfiniteData } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createPostAction } from "@/app/actions/post";
import { useSingleFlightAction } from "@/hooks/use-single-flight-action";
import {
  type PollDuration,
  pollEndsAtFrom,
  sanitizePollOptions,
} from "@/lib/poll";
import { type PostImageInput, publicImageUrl } from "@/lib/post-images";
import { queryKeys } from "@/lib/query";
import {
  patchPostAcrossFeed,
  prependFeedItem,
  replaceFeedItem,
} from "@/lib/query-cache";
import type { FeedResponse } from "@/lib/query-types";
import type {
  FeedItem,
  PostData,
  PostImageDisplay,
  QuotedPostData,
} from "@/types/post";
import type { PublicUser } from "@/types/user";

function isNonFollowingFeedQuery(queryKey: readonly unknown[]) {
  return queryKey[0] === "posts" && queryKey[1] !== "following";
}

type CreatePostVariables = {
  content: string;
  images?: PostImageInput[];
  poll?: { options: string[]; duration: PollDuration };
  quotedPostId?: string;
  // The already-loaded quoted post, embedded into the optimistic item (and
  // its server replacement — the action returns the raw row without it).
  quotedPost?: QuotedPostData;
  // Local object URLs so the optimistic item (and its server replacement)
  // render instantly without fetching the just-uploaded objects from R2.
  optimisticImages?: PostImageDisplay[];
};

export function useCreatePost(user: PublicUser | null) {
  const queryClient = useQueryClient();
  const submit = useSingleFlightAction(createPostAction);

  // Once the R2 copy is confirmed loadable (it lands in the browser cache,
  // immutable), strip the blob preview from the cached item and revoke it —
  // otherwise every posted image pins its local blob for the whole session.
  const releasePreviewWhenRemoteLoads = (
    postId: string,
    key: string,
    previewUrl: string,
  ) => {
    const remoteUrl = publicImageUrl(key);
    if (!remoteUrl) return;

    const remote = new Image();
    remote.onload = () => {
      queryClient.setQueriesData<InfiniteData<FeedResponse>>(
        { queryKey: queryKeys.postsRoot() },
        (current) =>
          patchPostAcrossFeed(current, postId, (post) => ({
            ...post,
            images: post.images?.map((image) =>
              image.key === key ? { ...image, previewUrl: undefined } : image,
            ),
          })),
      );
      URL.revokeObjectURL(previewUrl);
    };
    // On error keep the local preview — revoking would blank the image.
    remote.src = remoteUrl;
  };

  const mutation = useMutation({
    mutationFn: async ({
      content,
      images,
      poll,
      quotedPostId,
    }: CreatePostVariables) => {
      const res = await submit({ content, images, poll, quotedPostId });
      if (res?.error) {
        throw new Error(res.error);
      }
      return res;
    },
    onMutate: async ({
      content,
      optimisticImages,
      poll,
      quotedPostId,
      quotedPost,
    }) => {
      if (!user) return {};
      await queryClient.cancelQueries({ queryKey: queryKeys.postsRoot() });

      const previous = queryClient.getQueriesData<InfiniteData<FeedResponse>>({
        queryKey: queryKeys.postsRoot(),
      });

      // Temp option ids: the optimistic poll renders but is not votable until
      // the server swap brings the real ids (onSuccess below).
      const optimisticPollEndsAt = poll ? pollEndsAtFrom(poll.duration) : null;
      const optimisticPoll = poll
        ? {
            endsAt: optimisticPollEndsAt as Date,
            options: sanitizePollOptions(poll.options).map((label, idx) => ({
              id: `optimistic-opt-${idx}`,
              idx,
              label,
              voteCount: 0,
            })),
            myVoteOptionId: null,
          }
        : null;

      const optimisticPost: PostData = {
        id: `optimistic-${crypto.randomUUID()}`,
        content,
        images: optimisticImages?.length ? optimisticImages : null,
        quotedPostId: quotedPostId ?? null,
        quotedPost,
        pollEndsAt: optimisticPollEndsAt,
        poll: optimisticPoll,
        authorId: user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
        likeCount: 0,
        commentCount: 0,
        repostCount: 0,
        pollVoteCount: 0,
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
    onSuccess: (res, vars, ctx) => {
      if (res?.error) {
        toast.error(res.error);
        return;
      }

      if (user && res && "post" in res && res.post && ctx?.optimisticId) {
        const nextItem: FeedItem = {
          type: "post",
          post: {
            ...res.post,
            // Keep the local previews layered over the server keys so the
            // images don't flash a refetch when the optimistic item swaps.
            images: res.post.images?.map((image, i) => ({
              ...image,
              previewUrl: vars.optimisticImages?.[i]?.previewUrl,
            })),
            // The action returns the raw row; re-attach the embed we already
            // hold so the quoted card survives the optimistic->server swap.
            quotedPost: vars.quotedPost,
            // Real option ids from the action — without them the fresh poll
            // would be unvotable until a hard reload (no refetch-on-mount).
            poll: res.poll ? { ...res.poll, myVoteOptionId: null } : undefined,
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

        for (const image of nextItem.post.images ?? []) {
          if (image.previewUrl) {
            releasePreviewWhenRemoteLoads(
              res.post.id,
              image.key,
              image.previewUrl,
            );
          }
        }
      }

      toast.success("Post published.");
    },
  });

  return { submitPost: mutation.mutateAsync, isPending: mutation.isPending };
}
