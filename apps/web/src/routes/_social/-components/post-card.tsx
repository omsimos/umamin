import type { InfiniteData } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
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
  DropdownMenuTrigger,
} from "@umamin/ui/components/dropdown-menu";
import { cn } from "@umamin/ui/lib/utils";
import {
  BadgeCheckIcon,
  HeartIcon,
  MessageCircleIcon,
  MessageSquareTextIcon,
  Repeat2Icon,
  ScanFaceIcon,
} from "lucide-react";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { ComposeDialog } from "@/components/compose-dialog";
import { GroupBadge } from "@/components/group-badge";
import { PollCard } from "@/components/poll-card";
import { PostBody } from "@/components/post-body";
import { PostImages } from "@/components/post-images";
import { QuotedPostCard } from "@/components/quoted-post-card";
import { TimeAgo } from "@/components/time-ago";
import {
  BURST_ACTION_REJECT_MESSAGE,
  useBurstAction,
} from "@/hooks/use-burst-action";
import { Link } from "@/lib/navigation";
import { queryKeys } from "@/lib/query";
import {
  patchComment,
  patchPostAcrossFeed,
  patchPostResponse,
} from "@/lib/query-cache";
import {
  type CommentData,
  type CommentsResponse,
  type FeedResponse,
  type PostData,
  type PostResponse,
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

export function PostCard({
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
  const [liked, setLiked] = useState<boolean>(data.isLiked === true);
  const [likes, setLikes] = useState<number>(data.likeCount ?? 0);
  const [reposted, setReposted] = useState<boolean>(
    "isReposted" in data ? data.isReposted === true : false,
  );
  const [reposts, setReposts] = useState<number>(
    "repostCount" in data ? (data.repostCount ?? 0) : 0,
  );
  const [quoteOpen, setQuoteOpen] = useState(false);
  const queryClient = useQueryClient();

  // Like and repost writes are field-scoped (each patches ONLY its own pair and
  // leaves the rest of the cached entry untouched) — scoping the patch removes
  // the concurrent like + repost clobber race.
  const syncLikeCache = (nextLiked: boolean, nextLikes: number) => {
    if ("commentCount" in data) {
      queryClient.setQueriesData<InfiniteData<FeedResponse>>(
        { queryKey: queryKeys.postsRoot() },
        (current) =>
          patchPostAcrossFeed(current, data.id, (post) => ({
            ...post,
            isLiked: nextLiked,
            likeCount: nextLikes,
          })),
      );
      queryClient.setQueryData<PostResponse>(
        queryKeys.post(data.id),
        (current) =>
          patchPostResponse(current, (post) => ({
            ...post,
            isLiked: nextLiked,
            likeCount: nextLikes,
          })),
      );
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
    queryClient.setQueriesData<InfiniteData<FeedResponse>>(
      { queryKey: queryKeys.postsRoot() },
      (current) =>
        patchPostAcrossFeed(current, data.id, (post) => ({
          ...post,
          isReposted: nextReposted,
          repostCount: nextReposts,
        })),
    );
    queryClient.setQueryData<PostResponse>(queryKeys.post(data.id), (current) =>
      patchPostResponse(current, (post) => ({
        ...post,
        isReposted: nextReposted,
        repostCount: nextReposts,
      })),
    );
  };

  const dataIsReposted =
    "isReposted" in data ? data.isReposted === true : false;
  const dataRepostCount = "repostCount" in data ? (data.repostCount ?? 0) : 0;

  // Scalar deps only — depending on the `data` object (a fresh reference on most
  // parent renders) re-ran this effect constantly and could clobber optimistic
  // like/repost state mid-flight. Now it resyncs only when a value truly changes.
  useEffect(() => {
    setLiked(data.isLiked === true);
    setLikes(data.likeCount ?? 0);
    setReposted(dataIsReposted);
    setReposts(dataRepostCount);
  }, [data.isLiked, data.likeCount, dataIsReposted, dataRepostCount]);

  const handleLikeAction = useBurstAction(
    async (prevLiked: boolean) => {
      if (isComment) {
        return prevLiked
          ? removeCommentLikeAction({ commentId: data.id })
          : addCommentLikeAction({ commentId: data.id });
      }

      return prevLiked
        ? removeLikeAction({ postId: data.id })
        : addLikeAction({ postId: data.id });
    },
    {
      limit: 4,
      rejectMessage: BURST_ACTION_REJECT_MESSAGE,
    },
  );

  const handleRepostAction = useBurstAction(
    async (prevReposted: boolean) =>
      prevReposted
        ? removeRepostAction({ postId: data.id })
        : addRepostAction({ postId: data.id }),
    {
      limit: 4,
      rejectMessage: BURST_ACTION_REJECT_MESSAGE,
    },
  );

  const handleLike = async () => {
    const prevLiked = liked;
    const prevLikes = likes;
    const nextLiked = !prevLiked;
    const nextLikes = prevLiked ? Math.max(prevLikes - 1, 0) : prevLikes + 1;

    setLiked(nextLiked);
    setLikes(nextLikes);

    try {
      const res = await handleLikeAction(prevLiked);
      const actionError = getActionError(res);
      if (actionError) {
        throw new Error(actionError);
      }

      // Server no-op (the like row was already in the target state): the DB
      // count never moved, so drop our optimistic ±1 — keep the target flag but
      // restore the previous count — to avoid permanently drifting the cache.
      if (isAlreadyLiked(res) || isAlreadyRemoved(res)) {
        setLikes(prevLikes);
        syncLikeCache(nextLiked, prevLikes);
        return;
      }

      syncLikeCache(nextLiked, nextLikes);
      if (isComment) {
        toast.success(prevLiked ? "Comment unliked." : "Comment liked.");
      } else {
        toast.success(prevLiked ? "Post unliked." : "Post liked.");
      }
    } catch (err) {
      setLiked(prevLiked);
      setLikes(prevLikes);
      toast.error(err instanceof Error ? err.message : "Couldn't update like.");
      console.log(err);
    }
  };

  const handleRepost = async () => {
    const prevReposted = reposted;
    const prevReposts = reposts;

    setReposted(!prevReposted);
    setReposts((v) => (prevReposted ? Math.max(v - 1, 0) : v + 1));

    try {
      const res = await handleRepostAction(prevReposted);
      const actionError = getActionError(res);
      if (actionError) {
        throw new Error(actionError);
      }
      if (prevReposted) {
        // Remove branch. If the row was already gone, the DB count never moved,
        // so restore our optimistic -1 instead of persisting an undercount.
        if (isAlreadyRemoved(res)) {
          setReposts(prevReposts);
          syncRepostCache(false, prevReposts);
          toast.success("Repost removed.");
          return;
        }
        toast.success("Repost removed.");
        syncRepostCache(false, Math.max(prevReposts - 1, 0));
      } else {
        if (isAlreadyReposted(res)) {
          setReposted(prevReposted);
          setReposts(prevReposts);
          toast.error("Already reposted.");
          return;
        }
        toast.success("Reposted.");
        syncRepostCache(true, prevReposts + 1);
      }
    } catch (err) {
      setReposted(prevReposted);
      setReposts(prevReposts);
      toast.error(
        err instanceof Error ? err.message : "Couldn't update repost.",
      );
      console.log(err);
    }
  };

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
          <AvatarFallback>
            <ScanFaceIcon />
          </AvatarFallback>
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
              />
            )}
          </div>
        </div>

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
          <QuotedPostCard post={quotablePost.quotedPost ?? null} />
        )}

        {/* gap-4 (not space-x) so the controls' negative margins can enlarge
            their tap targets without shifting the visual layout. */}
        <div className="relative z-10 flex items-center gap-4 text-muted-foreground mt-4">
          <Button
            type="button"
            variant="ghost"
            disabled={!isAuthenticated}
            onClick={handleLike}
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
                    handleRepost();
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
