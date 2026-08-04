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
import { useEffect, useState } from "react";
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
import { vibrate } from "@/lib/haptics";
import { Link } from "@/lib/navigation";
import { queryKeys } from "@/lib/query";
import { patchPostAcrossFeed, patchPostResponse } from "@/lib/query-cache";
import {
  type FeedResponse,
  type PostData,
  type PostResponse,
  toQuotedPostData,
} from "@/lib/types";
import {
  getActionError,
  hasUmaminPlus,
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
};

export function PostCardMain({ data, imageId, isAuthenticated }: Props) {
  const author = data.author;
  const [liked, setLiked] = useState<boolean>(data.isLiked === true);
  const [likes, setLikes] = useState<number>(data.likeCount ?? 0);
  const [reposted, setReposted] = useState<boolean>(data.isReposted === true);
  const [reposts, setReposts] = useState<number>(data.repostCount ?? 0);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const queryClient = useQueryClient();

  // Field-scoped cache writes: like and repost each patch ONLY their own pair so
  // a concurrent like + repost can't clobber each other with stale closure values.
  const syncLikeCache = (nextLiked: boolean, nextLikes: number) => {
    queryClient.setQueriesData<InfiniteData<FeedResponse>>(
      { queryKey: queryKeys.postsRoot() },
      (current) =>
        patchPostAcrossFeed(current, data.id, (post) => ({
          ...post,
          isLiked: nextLiked,
          likeCount: nextLikes,
        })),
    );
    queryClient.setQueryData<PostResponse>(queryKeys.post(data.id), (current) =>
      patchPostResponse(current, (post) => ({
        ...post,
        isLiked: nextLiked,
        likeCount: nextLikes,
      })),
    );
  };

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

  useEffect(() => {
    setLiked(data.isLiked === true);
    setLikes(data.likeCount ?? 0);
    setReposted(data.isReposted === true);
    setReposts(data.repostCount ?? 0);
  }, [data.isLiked, data.likeCount, data.isReposted, data.repostCount]);

  const handleLikeAction = useBurstAction(
    async (prevLiked: boolean) =>
      prevLiked
        ? removeLikeAction({ postId: data.id })
        : addLikeAction({ postId: data.id }),
    {
      limit: 6,
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

    // Micro-tick on like only — undoing one isn't a moment.
    if (nextLiked) {
      vibrate(5);
    }

    setLiked(nextLiked);
    setLikes(nextLikes);

    try {
      const res = await handleLikeAction(prevLiked);
      const actionError = getActionError(res);
      if (actionError) {
        throw new Error(actionError);
      }

      // Server no-op (like row already in target state): drop the optimistic ±1.
      if (isAlreadyLiked(res) || isAlreadyRemoved(res)) {
        setLikes(prevLikes);
        syncLikeCache(nextLiked, prevLikes);
        return;
      }

      syncLikeCache(nextLiked, nextLikes);
      toast.success(prevLiked ? "Post unliked." : "Post liked.");
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
              "avatar-shine": hasUmaminPlus(author.createdAt),
            })}
          >
            <AvatarImage src={author.imageUrl ?? ""} alt="User avatar" />
            <AvatarFallback>
              <ScanFaceIcon />
            </AvatarFallback>
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

        {data.quotedPostId && <QuotedPostCard post={data.quotedPost ?? null} />}

        <div className="flex items-center space-x-4 text-muted-foreground mt-4">
          <Button
            disabled={!isAuthenticated}
            type="button"
            variant="ghost"
            onClick={handleLike}
            aria-label={liked ? "Unlike post" : "Like post"}
            aria-pressed={liked}
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                disabled={!isAuthenticated}
                type="button"
                variant="ghost"
                aria-label="Repost options"
                className={cn(
                  "h-auto gap-0 p-0 flex space-x-1 items-center hover:bg-transparent disabled:opacity-100",
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
