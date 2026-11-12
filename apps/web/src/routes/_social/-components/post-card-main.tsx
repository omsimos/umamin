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
import { useState } from "react";
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
import { useReactionToggle } from "@/hooks/use-reaction-toggle";
import { vibrate } from "@/lib/haptics";
import { Link } from "@/lib/navigation";
import { patchPostEverywhere } from "@/lib/query-cache";
import { type PostData, toQuotedPostData } from "@/lib/types";
import {
  hasPlusFeatures,
  isAlreadyLiked,
  isAlreadyRemoved,
  isAlreadyReposted,
} from "@/lib/utils";
import {
  addLikeAction,
  addRepostAction,
  removeLikeAction,
  removeRepostAction,
} from "../-lib/actions";

type Props = {
  data: PostData;
  // Stable screenshot-target id (shared with PostHeader's Save Image).
  imageId: string;
  isAuthenticated?: boolean;
  currentUserId?: string;
};

export function PostCardMain({
  data,
  imageId,
  isAuthenticated,
  currentUserId,
}: Props) {
  const author = data.author;
  const [quoteOpen, setQuoteOpen] = useState(false);
  const queryClient = useQueryClient();

  // Field-scoped cache writes: like and repost each patch ONLY their own pair so
  // a concurrent like + repost can't clobber each other with stale closure values.
  const syncLikeCache = (nextLiked: boolean, nextLikes: number) => {
    patchPostEverywhere(queryClient, data.id, (post) => ({
      ...post,
      isLiked: nextLiked,
      likeCount: nextLikes,
    }));
  };

  const syncRepostCache = (nextReposted: boolean, nextReposts: number) => {
    patchPostEverywhere(queryClient, data.id, (post) => ({
      ...post,
      isReposted: nextReposted,
      repostCount: nextReposts,
    }));
  };

  const like = useReactionToggle({
    on: data.isLiked === true,
    count: data.likeCount ?? 0,
    request: (nextLiked) =>
      nextLiked
        ? addLikeAction({ postId: data.id })
        : removeLikeAction({ postId: data.id }),
    // Server no-op (like row already in target state): drop the optimistic ±1
    // for the server's count.
    isNoop: (res) => isAlreadyLiked(res) || isAlreadyRemoved(res),
    onResponse: (nextLiked, noop) => {
      if (!noop) toast.success(nextLiked ? "Post liked." : "Post unliked.");
    },
    writeCache: (state) => syncLikeCache(state.on, state.count),
    fallbackError: "Couldn't update like.",
    errorSource: "like",
    burstLimit: 6,
  });

  const repost = useReactionToggle({
    on: data.isReposted === true,
    count: data.repostCount ?? 0,
    request: (nextReposted) =>
      nextReposted
        ? addRepostAction({ postId: data.id })
        : removeRepostAction({ postId: data.id }),
    isNoop: (res, nextReposted) =>
      nextReposted ? isAlreadyReposted(res) : isAlreadyRemoved(res),
    onResponse: (nextReposted, noop) => {
      // Removing shows the same toast whether or not the row was still there.
      if (!nextReposted) toast.success("Repost removed.");
      else if (noop) toast.error("Already reposted.");
      else toast.success("Reposted.");
    },
    writeCache: (state) => syncRepostCache(state.on, state.count),
    fallbackError: "Couldn't update repost.",
    errorSource: "repost",
  });

  const liked = like.on;
  const likes = like.count;
  const reposted = repost.on;
  const reposts = repost.count;

  const handleLike = () => {
    // Micro-tick on like only — undoing one isn't a moment.
    if (like.toggle()) {
      vibrate(5);
    }
  };

  return (
    <div
      id={imageId}
      className="px-7 container border-x-0 sm:border-x border border-muted py-6 bg-muted/50 sm:rounded-md sm:px-6"
    >
      <div className="flex justify-center gap-3">
        <Link
          href={`/user/${author.username}`}
          aria-label={`@${author.username}'s profile`}
          className="shrink-0 self-start"
        >
          <Avatar
            className={cn({
              "avatar-shine": hasPlusFeatures(author),
            })}
          >
            <AvatarImage src={author.imageUrl ?? ""} alt="User avatar" />
            <BlobatarFallback seed={author.id} />
          </Avatar>
        </Link>

        <div className="flex justify-between w-full items-center text-[15px]">
          <div className="flex items-center space-x-1">
            <Link
              href={`/user/${author.username}`}
              className="font-semibold hover:underline"
            >
              {author.displayName || author.username}
            </Link>

            {author.username &&
              import.meta.env.VITE_VERIFIED_USERS?.split(",").includes(
                author.username,
              ) && <BadgeCheckIcon className="w-4 h-4 text-pink-500" />}
            <GroupBadge badge={author.groupBadge} />
            <StreakChip state={author} />
            <Link
              href={`/user/${author.username}`}
              className="truncate text-muted-foreground hover:underline"
            >
              @{author.username}
            </Link>
          </div>

          <div className="flex items-center gap-2 text-muted-foreground">
            <TimeAgo
              date={data.createdAt}
              className="text-muted-foreground text-xs"
            />
          </div>
        </div>
      </div>

      <div className="text-[15px] w-full">
        <ContentCover
          label={data.moderation}
          revealKey={`post:${data.id}`}
          target={{ kind: "post", id: data.id }}
          isOwn={!!currentUserId && currentUserId === data.author?.id}
          isAuthenticated={!!isAuthenticated}
        >
          <PostBody content={data.content} className="mt-1" />

          {data.poll && (
            <PollCard
              postId={data.id}
              poll={data.poll}
              isAuthenticated={!!isAuthenticated}
            />
          )}

          {data.images && data.images.length > 0 && (
            <PostImages images={data.images} />
          )}

          {data.quotedPostId && (
            <QuotedPostCard
              post={data.quotedPost ?? null}
              isAuthenticated={!!isAuthenticated}
              currentUserId={currentUserId}
            />
          )}
        </ContentCover>

        {/* gap-4 (not space-x) so the controls' negative margins can enlarge
            their tap targets without shifting the visual layout. */}
        <div className="flex items-center gap-4 text-muted-foreground mt-4">
          <Button
            disabled={!isAuthenticated}
            type="button"
            variant="ghost"
            onClick={handleLike}
            aria-label={liked ? "Unlike post" : "Like post"}
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                disabled={!isAuthenticated}
                type="button"
                variant="ghost"
                aria-label="Repost options"
                className={cn(
                  "h-auto gap-0 -m-2 p-2 flex space-x-1 items-center hover:bg-transparent disabled:opacity-100",
                  reposted
                    ? "text-emerald-600 hover:text-emerald-600"
                    : "hover:text-muted-foreground",
                )}
              >
                <Repeat2Icon
                  className={cn("size-5", {
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

          <div className="flex space-x-1 items-center">
            <MessageCircleIcon className="h-5 w-5" />
            <span>{data.commentCount}</span>
          </div>
        </div>
      </div>

      {quoteOpen && (
        <ComposeDialog
          open={quoteOpen}
          onOpenChange={setQuoteOpen}
          quotedPost={toQuotedPostData(data)}
        />
      )}
    </div>
  );
}
