import type { InfiniteData } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarImage } from "@umamin/ui/components/avatar";
import { Button } from "@umamin/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@umamin/ui/components/dropdown-menu";
import { cn } from "@umamin/ui/lib/utils";
import {
  BadgeCheckIcon,
  HeartIcon,
  MessageCircleIcon,
  MessageSquareTextIcon,
  Repeat2Icon,
} from "lucide-react";
import { memo, useId, useState } from "react";
import { toast } from "sonner";
import { BlobatarFallback } from "@/components/blobatar-fallback";
import { ComposeDialog } from "@/components/compose-dialog";
import { ContentCover } from "@/components/content-cover";
import { GroupBadge } from "@/components/group-badge";
import { PollCard } from "@/components/poll-card";
import { PostBody } from "@/components/post-body";
import { PostImages } from "@/components/post-images";
import { QuotedPostCard } from "@/components/quoted-post-card";
import { StreakChip } from "@/components/streak";
import { TimeAgo } from "@/components/time-ago";
import {
  BURST_ACTION_REJECT_MESSAGE,
  useBurstAction,
} from "@/hooks/use-burst-action";
import { useOptimisticToggle } from "@/hooks/use-optimistic-toggle";
import { ExpectedError } from "@/lib/expected-error";
import { Link } from "@/lib/navigation";
import { captureException } from "@/lib/posthog";
import { queryKeys } from "@/lib/query";
import { patchComment, patchPostEverywhere } from "@/lib/query-cache";
import {
  type CommentData,
  type CommentsResponse,
  type PostData,
  toQuotedPostData,
} from "@/lib/types";
import {
  getActionError,
  hasPlusFeatures,
  isAlreadyLiked,
  isAlreadyRemoved,
  isAlreadyReposted,
} from "@/lib/utils";
import {
  addCommentLikeAction,
  addLikeAction,
  addRepostAction,
  removeCommentLikeAction,
  removeLikeAction,
  removeRepostAction,
} from "../-lib/actions";
import { CommentMenu } from "./comment-menu";
import { PostMenu } from "./post-menu";

type Props = {
  isComment?: boolean;
  isAuthenticated: boolean;
  currentUserId?: string;
  className?: string;
  data: PostData | CommentData;
};

function PostCardImpl({
  data,
  isComment,
  isAuthenticated,
  currentUserId,
  className,
}: Props) {
  const author = data?.author;
  const commentPostId = "postId" in data ? data.postId : undefined;
  const commentCount = "commentCount" in data ? data.commentCount : undefined;
  const imageId = useId();
  const imageTargetId = `umamin-${imageId}`;
  const [quoteOpen, setQuoteOpen] = useState(false);
  const queryClient = useQueryClient();

  // Like and repost writes are field-scoped (each patches ONLY its own pair and
  // leaves the rest of the cached entry untouched) — scoping the patch removes
  // the concurrent like + repost clobber race.
  const syncLikeCache = (nextLiked: boolean, nextLikes: number) => {
    if ("commentCount" in data) {
      patchPostEverywhere(queryClient, data.id, (post) => ({
        ...post,
        isLiked: nextLiked,
        likeCount: nextLikes,
      }));
    } else if (commentPostId) {
      queryClient.setQueryData<InfiniteData<CommentsResponse>>(
        queryKeys.postComments(commentPostId),
        (current) =>
          patchComment(current, data.id, (comment) => ({
            ...comment,
            isLiked: nextLiked,
            likeCount: nextLikes,
          })),
      );
    }
  };

  // Reposts only exist on posts (never comments), so patch the feed + post caches.
  const syncRepostCache = (nextReposted: boolean, nextReposts: number) => {
    patchPostEverywhere(queryClient, data.id, (post) => ({
      ...post,
      isReposted: nextReposted,
      repostCount: nextReposts,
    }));
  };

  const handleLikeAction = useBurstAction(
    async (nextLiked: boolean) => {
      if (isComment) {
        return nextLiked
          ? addCommentLikeAction({ commentId: data.id })
          : removeCommentLikeAction({ commentId: data.id });
      }

      return nextLiked
        ? addLikeAction({ postId: data.id })
        : removeLikeAction({ postId: data.id });
    },
    {
      limit: 4,
      rejectMessage: BURST_ACTION_REJECT_MESSAGE,
    },
  );

  const handleRepostAction = useBurstAction(
    async (nextReposted: boolean) =>
      nextReposted
        ? addRepostAction({ postId: data.id })
        : removeRepostAction({ postId: data.id }),
    {
      limit: 4,
      rejectMessage: BURST_ACTION_REJECT_MESSAGE,
    },
  );

  const like = useOptimisticToggle({
    on: data.isLiked === true,
    count: data.likeCount ?? 0,
    send: async (nextLiked) => {
      const res = await handleLikeAction(nextLiked);
      const actionError = getActionError(res);
      if (actionError) {
        throw new ExpectedError(actionError);
      }

      // Server no-op (the like row was already in the target state): the DB
      // count never moved, so the optimistic ±1 is dropped.
      if (isAlreadyLiked(res) || isAlreadyRemoved(res)) {
        return "unchanged";
      }

      if (isComment) {
        toast.success(nextLiked ? "Comment liked." : "Comment unliked.");
      } else {
        toast.success(nextLiked ? "Post liked." : "Post unliked.");
      }
      return "changed";
    },
    onSettled: (state) => syncLikeCache(state.on, state.count),
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Couldn't update like.");
      captureException(err, { source: "like" });
    },
  });

  const repost = useOptimisticToggle({
    on: "isReposted" in data ? data.isReposted === true : false,
    count: "repostCount" in data ? (data.repostCount ?? 0) : 0,
    send: async (nextReposted) => {
      const res = await handleRepostAction(nextReposted);
      const actionError = getActionError(res);
      if (actionError) {
        throw new ExpectedError(actionError);
      }
      // A no-op leaves the DB count where it was, so the optimistic ±1 is
      // dropped instead of persisting a drifted count.
      if (!nextReposted) {
        toast.success("Repost removed.");
        return isAlreadyRemoved(res) ? "unchanged" : "changed";
      }
      if (isAlreadyReposted(res)) {
        toast.error("Already reposted.");
        return "unchanged";
      }
      toast.success("Reposted.");
      return "changed";
    },
    onSettled: (state) => syncRepostCache(state.on, state.count),
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Couldn't update repost.",
      );
      captureException(err, { source: "repost" });
    },
  });

  const liked = like.on;
  const likes = like.count;
  const reposted = repost.on;
  const reposts = repost.count;

  // Quotes are real posts now — narrow once for the dialog + embed render.
  const quotablePost = !isComment && "repostCount" in data ? data : null;

  return (
    <div
      id={imageTargetId}
      className={cn(
        className,
        "relative flex space-x-3 container text-[15px]",
        "border-b py-3",
        {
          "transition-colors hover:bg-muted/30": !isComment,
        },
      )}
    >
      {/* Whole-card open-thread target. A real <a> (keyboard + prefetch); the
          interactive children below are raised (z-10) so they keep their own
          behavior. Inline @mentions/links in the body open the thread too. */}
      {!isComment && (
        <Link
          href={`/post/${data.id}`}
          aria-label="Open post"
          className="absolute inset-0"
        />
      )}

      <Link
        href={`/user/${author?.username}`}
        aria-label={`@${author?.username}'s profile`}
        className="relative z-10 shrink-0 self-start"
      >
        <Avatar
          className={cn({
            "avatar-shine": hasPlusFeatures(author),
          })}
        >
          <AvatarImage src={author?.imageUrl ?? ""} alt="User avatar" />
          <BlobatarFallback seed={author?.id} />
        </Avatar>
      </Link>

      <div className="w-full min-w-0">
        <div className="flex justify-between">
          <div className="flex items-center space-x-1">
            <Link
              href={`/user/${author?.username}`}
              className="relative z-10 font-semibold hover:underline"
            >
              {author?.displayName || author?.username}
            </Link>

            {author?.username &&
              import.meta.env.VITE_VERIFIED_USERS?.split(",").includes(
                author.username,
              ) && <BadgeCheckIcon className="w-4 h-4 text-pink-500" />}
            <GroupBadge badge={author?.groupBadge} />
            <StreakChip state={author} />
            <Link
              href={`/user/${author?.username}`}
              className="relative z-10 truncate text-muted-foreground hover:underline"
            >
              @{author?.username}
            </Link>
          </div>

          <div className="relative z-10 flex items-center gap-2 text-muted-foreground">
            {data?.createdAt && (
              <TimeAgo
                date={data.createdAt}
                className="text-muted-foreground text-xs"
              />
            )}

            {!isComment && isAuthenticated && (
              <PostMenu
                postId={data.id}
                authorId={author?.id ?? ""}
                authorUsername={author?.username}
                imageId={imageTargetId}
                isAuthenticated={isAuthenticated}
                currentUserId={currentUserId}
              />
            )}

            {isComment && isAuthenticated && commentPostId && (
              <CommentMenu
                commentId={data.id}
                postId={commentPostId}
                authorId={author?.id ?? ""}
                authorUsername={author?.username}
                isAuthenticated={isAuthenticated}
                currentUserId={currentUserId}
                isMuted={"isMuted" in data && data.isMuted === true}
              />
            )}
          </div>
        </div>

        <ContentCover
          label={data.moderation}
          revealKey={`${isComment ? "comment" : "post"}:${data.id}`}
          target={{ kind: isComment ? "comment" : "post", id: data.id }}
          isOwn={!!currentUserId && currentUserId === author?.id}
          isAuthenticated={isAuthenticated}
          noun={isComment ? "comment" : "post"}
        >
          <PostBody content={data?.content ?? ""} className="mt-1" />

          {!isComment && "poll" in data && data.poll && (
            <PollCard
              postId={data.id}
              poll={data.poll}
              isAuthenticated={isAuthenticated}
            />
          )}

          {"images" in data && data.images && data.images.length > 0 && (
            <PostImages images={data.images} />
          )}

          {quotablePost?.quotedPostId && (
            <QuotedPostCard
              post={quotablePost.quotedPost ?? null}
              isAuthenticated={isAuthenticated}
              currentUserId={currentUserId}
            />
          )}
        </ContentCover>

        {/* gap-4 (not space-x) so the controls' negative margins can enlarge
            their tap targets without shifting the visual layout. */}
        <div className="relative z-10 flex items-center gap-4 text-muted-foreground mt-4">
          <Button
            type="button"
            variant="ghost"
            disabled={!isAuthenticated}
            onClick={like.toggle}
            aria-label={`${liked ? "Unlike" : "Like"} ${isComment ? "comment" : "post"}`}
            aria-pressed={liked}
            className={cn(
              "h-auto gap-0 -m-2 p-2 flex space-x-1 items-center hover:bg-transparent disabled:opacity-100",
              liked
                ? "text-pink-500 hover:text-pink-500"
                : "hover:text-muted-foreground",
            )}
          >
            <HeartIcon
              className={cn("size-5", {
                "fill-pink-500": liked,
              })}
            />
            <span>{likes}</span>
          </Button>

          {!isComment && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={!isAuthenticated}
                  aria-label="Repost options"
                  className={cn(
                    "h-auto gap-0 -m-2 p-2 flex space-x-1 items-center hover:bg-transparent disabled:opacity-100",
                    reposted
                      ? "text-emerald-600 hover:text-emerald-600"
                      : "hover:text-muted-foreground",
                  )}
                >
                  <Repeat2Icon
                    className={cn("size-6", {
                      "text-emerald-600": reposted,
                    })}
                  />
                  <span>{reposts}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center">
                <DropdownMenuItem
                  onClick={() => {
                    repost.toggle();
                  }}
                >
                  <span className="flex items-center gap-2">
                    <Repeat2Icon className="h-4 w-4" />
                    {reposted ? "Remove repost" : "Repost"}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setQuoteOpen(true);
                  }}
                >
                  <span className="flex items-center gap-2">
                    <MessageSquareTextIcon className="h-4 w-4" />
                    Quote
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {!isComment && (
            <Link
              href={`/post/${data?.id}`}
              aria-label={`View ${commentCount ?? 0} comments`}
              className="flex space-x-1 items-center -m-2 p-2"
            >
              <MessageCircleIcon className="h-5 w-5" />
              <span>{commentCount ?? 0}</span>
            </Link>
          )}
        </div>
      </div>

      {quoteOpen && quotablePost && (
        <ComposeDialog
          open={quoteOpen}
          onOpenChange={setQuoteOpen}
          quotedPost={toQuotedPostData(quotablePost)}
        />
      )}
    </div>
  );
}

// A like/repost tap patches one post in the query cache; without this every
// loaded card in the feed re-renders. patchPostAcrossFeed keeps unchanged items
// reference-stable, which is what makes the default shallow compare effective.
export const PostCard = memo(PostCardImpl);
