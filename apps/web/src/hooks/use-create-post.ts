import type { InfiniteData } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { showSaveToast } from "@/hooks/use-restore-streak";
import { useSingleFlightAction } from "@/hooks/use-single-flight-action";
import { createPostAction } from "@/lib/actions";
import { ExpectedError } from "@/lib/expected-error";
import {
  type PollDuration,
  pollEndsAtFrom,
  sanitizePollOptions,
} from "@/lib/poll";
import { clientImageUrl, type PostImageInput } from "@/lib/post-images";
import { queryKeys } from "@/lib/query";
import {
  applyStreakUpdate,
  patchPostAcrossFeed,
  prependFeedItem,
  removePostFromFeed,
  replaceFeedItem,
} from "@/lib/query-cache";
import type {
  FeedItem,
  FeedResponse,
  PostData,
  PostImageDisplay,
  PublicUser,
  QuotedPostData,
} from "@/lib/types";

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
    const remoteUrl = clientImageUrl(key);
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
        throw new ExpectedError(res.error);
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
      // Only feeds that hold data get the optimistic post, so only they need
      // their in-flight fetch stopped. Cancelling a first load would leave
      // that feed on its skeleton with nothing to fetch it again.
      await queryClient.cancelQueries({
        queryKey: queryKeys.postsRoot(),
        predicate: (query) => query.state.data !== undefined,
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
        // A feed with no data yet (failed or cancelled first load) is left
        // to load normally. Seeding it would leave a one-post feed with no
        // next cursor that the loader serves as-is.
        (current) => (current ? prependFeedItem(current, optimistic) : current),
      );

      return { optimisticId: optimisticPost.id };
    },
    onError: (err, _vars, ctx) => {
      // Remove only the optimistic item. Restoring whole-feed snapshots would
      // also undo likes and votes made while the post was sending.
      if (ctx?.optimisticId) {
        const { optimisticId } = ctx;
        queryClient.setQueriesData<InfiniteData<FeedResponse>>(
          {
            queryKey: queryKeys.postsRoot(),
            predicate: (query) => isNonFollowingFeedQuery(query.queryKey),
          },
          (current) => removePostFromFeed(current, optimisticId),
        );
      }
      toast.error(err.message ?? "Couldn't post.");
    },
    onSuccess: (res, vars, ctx) => {
      if (res?.error) {
        toast.error(res.error);
        return;
      }

      const update = res?.streakUpdate ?? null;
      if (user && update) applyStreakUpdate(queryClient, user.username, update);

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
            author: update ? { ...user, ...update } : user,
            isLiked: false,
            isReposted: false,
          },
        };

        const postId = res.post.id;
        queryClient.setQueriesData<InfiniteData<FeedResponse>>(
          {
            queryKey: queryKeys.postsRoot(),
            predicate: (query) => isNonFollowingFeedQuery(query.queryKey),
          },
          (previous) => {
            if (!previous) return previous;
            const has = (id: string) =>
              previous.pages.some((page) =>
                page.data.some(
                  (item) => item.type === "post" && item.post.id === id,
                ),
              );
            if (has(ctx.optimisticId)) {
              return replaceFeedItem(
                previous,
                (item) =>
                  item.type === "post" && item.post.id === ctx.optimisticId,
                nextItem,
              );
            }
            // A feed whose first load finished while the post was sending
            // never got the optimistic item, and its cached read predates
            // the post.
            return has(postId) ? previous : prependFeedItem(previous, nextItem);
          },
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

      showSaveToast(queryClient, "Post published.", update);
    },
  });

  return { submitPost: mutation.mutateAsync, isPending: mutation.isPending };
}
