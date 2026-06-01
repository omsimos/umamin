"use client";

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
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import {
  addCommentLikeAction,
  addLikeAction,
  addRepostAction,
  removeCommentLikeAction,
  removeLikeAction,
  removeRepostAction,
} from "@/app/actions/post";
import { PostBody } from "@/components/post-body";
import { TimeAgo } from "@/components/time-ago";
import {
  BURST_ACTION_REJECT_MESSAGE,
  useBurstAction,
} from "@/hooks/use-burst-action";
import { queryKeys } from "@/lib/query";
import {
  patchComment,
  patchPostAcrossFeed,
  patchPostResponse,
} from "@/lib/query-cache";
import type {
  CommentsResponse,
  FeedResponse,
  PostResponse,
} from "@/lib/query-types";
import {
  getActionError,
  isAlreadyLiked,
  isAlreadyRemoved,
  isAlreadyReposted,
  isOlderThanOneYear,
} from "@/lib/utils";
import type { CommentData, PostData } from "@/types/post";
import { CommentMenu } from "./comment-menu";
import { PostMenu } from "./post-menu";
import { RepostDialog } from "./repost-dialog";

type Props = {
  isComment?: boolean;
  isRepost?: boolean;
  isAuthenticated: boolean;
  currentUserId?: string;
  className?: string;
  data: PostData | CommentData;
};

export function PostCard({
  data,
  isComment,
  isRepost,
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
  const [repostDialogOpen, setRepostDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  // Like and repost writes are field-scoped (each patches ONLY its own pair and
  // leaves the rest of the cached entry untouched). Writing all four fields at
  // once let a concurrent like + repost clobber each other with stale closure
  // values; scoping the patch removes that race.
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

  const handleQuoteRepost = async (content: string) => {
    const prevReposted = reposted;
    const prevReposts = reposts;

    if (prevReposted) {
      toast.error("Remove repost before quoting.");
      return;
    }

    setReposted(true);
    setReposts((v) => v + 1);

    try {
      const res = await addRepostAction({ postId: data.id, content });
      const actionError = getActionError(res);
      if (actionError) {
        throw new Error(actionError);
      }
      if (isAlreadyReposted(res)) {
        setReposted(prevReposted);
        setReposts(prevReposts);
        toast.error("Already reposted.");
        return;
      }
      toast.success("Quote reposted.");
      syncRepostCache(true, prevReposts + 1);
    } catch (err) {
      setReposted(prevReposted);
      setReposts(prevReposts);
      toast.error("Couldn't repost.");
      console.log(err);
    }
  };

  return (
    <div
      id={imageTargetId}
      className={cn(
        className,
        "relative flex space-x-3 container text-[15px]",
        {
          "border-b py-3": !isRepost,
          "border border-muted rounded-md px-2 py-3 sm:px-4": isRepost,
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

      <Avatar
        className={cn({
          "avatar-shine": isOlderThanOneYear(author?.createdAt),
        })}
      >
        <AvatarImage src={author?.imageUrl ?? ""} alt="User avatar" />
        <AvatarFallback>
          <ScanFaceIcon />
        </AvatarFallback>
      </Avatar>

      <div className="w-full min-w-0">
        <div className="flex justify-between">
          <div className="flex items-center space-x-1">
            <Link
              href={`/user/${author?.username}`}
              className="relative z-10 font-semibold hover:underline"
            >
              {author?.displayName}
            </Link>

            {author?.username &&
              process.env.NEXT_PUBLIC_VERIFIED_USERS?.split(",").includes(
                author.username,
              ) && <BadgeCheckIcon className="w-4 h-4 text-pink-500" />}
            <span className="text-muted-foreground">@{author?.username}</span>
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
                isAuthenticated={isAuthenticated}
                currentUserId={currentUserId}
              />
            )}
          </div>
        </div>

        <PostBody content={data?.content ?? ""} className="mt-1" />

        <div className="relative z-10 flex items-center space-x-4 text-muted-foreground mt-4">
          <Button
            type="button"
            variant="ghost"
            disabled={!isAuthenticated}
            onClick={handleLike}
            aria-label={`${liked ? "Unlike" : "Like"} ${isComment ? "comment" : "post"}`}
            aria-pressed={liked}
            // Ghost + neutralizers preserve the bare inline look (no box/fade/
            // hover-bg); we only want the focus-visible ring Button adds.
            className={cn(
              "h-auto gap-0 p-0 flex space-x-1 items-center hover:bg-transparent disabled:opacity-100",
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
                    "h-auto gap-0 p-0 flex space-x-1 items-center hover:bg-transparent disabled:opacity-100",
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
                    setRepostDialogOpen(true);
                  }}
                  disabled={reposted}
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
            <div className="flex space-x-1 items-center">
              <Link
                href={`/post/${data?.id}`}
                aria-label={`View ${commentCount ?? 0} comments`}
              >
                <MessageCircleIcon className="h-5 w-5" />
              </Link>
              <span>{commentCount ?? 0}</span>
            </div>
          )}
        </div>
      </div>

      {!isComment && (
        <RepostDialog
          open={repostDialogOpen}
          onOpenChange={setRepostDialogOpen}
          isAuthenticated={isAuthenticated}
          isReposted={reposted}
          onQuote={handleQuoteRepost}
        />
      )}
    </div>
  );
}
