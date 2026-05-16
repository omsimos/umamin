"use client";

import type { InfiniteData } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@umamin/ui/components/avatar";
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
import { useId, useState } from "react";
import { toast } from "sonner";
import {
  BURST_ACTION_REJECT_MESSAGE,
  useBurstAction,
} from "@/hooks/use-burst-action";
import {
  addLike,
  addRepost,
  removeLike,
  removeRepost,
} from "@/lib/api-mutations";
import { queryKeys } from "@/lib/query";
import { patchPostAcrossFeed, patchPostResponse } from "@/lib/query-cache";
import type { FeedResponse, PostResponse } from "@/lib/query-types";
import {
  isAlreadyRemoved,
  isAlreadyReposted,
  isOlderThanOneYear,
  shortTimeAgo,
} from "@/lib/utils";
import { isVerifiedUser } from "@/lib/verified-users";
import type { PostData } from "@/types/post";
import { PostMenu } from "./post-menu";
import { RepostDialog } from "./repost-dialog";

type Props = {
  data: PostData;
  isAuthenticated?: boolean;
  currentUserId?: string;
};

export function PostCardMain({ data, isAuthenticated, currentUserId }: Props) {
  const author = data.author;
  const imageId = useId();
  const imageTargetId = `umamin-${imageId}`;
  const liked = data.isLiked === true;
  const likes = data.likeCount ?? 0;
  const reposted = data.isReposted === true;
  const reposts = data.repostCount ?? 0;
  const [repostDialogOpen, setRepostDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const syncPostCache = (
    nextLiked: boolean,
    nextLikes: number,
    nextReposted: boolean,
    nextReposts: number,
  ) => {
    queryClient.setQueryData<InfiniteData<FeedResponse>>(
      queryKeys.posts("viewer"),
      (current) =>
        patchPostAcrossFeed(current, data.id, (post) => ({
          ...post,
          isLiked: nextLiked,
          likeCount: nextLikes,
          isReposted: nextReposted,
          repostCount: nextReposts,
        })),
    );
    queryClient.setQueryData<PostResponse>(
      queryKeys.post(data.id, "viewer"),
      (current) =>
        patchPostResponse(current, (post) => ({
          ...post,
          isLiked: nextLiked,
          likeCount: nextLikes,
          isReposted: nextReposted,
          repostCount: nextReposts,
        })),
    );
  };

  const handleLikeAction = useBurstAction(
    async (prevLiked: boolean) =>
      prevLiked
        ? removeLike({ postId: data.id })
        : addLike({ postId: data.id }),
    {
      limit: 6,
      rejectMessage: BURST_ACTION_REJECT_MESSAGE,
    },
  );

  const handleRepostAction = useBurstAction(
    async (prevReposted: boolean) =>
      prevReposted
        ? removeRepost({ postId: data.id })
        : addRepost({ postId: data.id }),
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

    syncPostCache(nextLiked, nextLikes, reposted, reposts);

    try {
      await handleLikeAction(prevLiked);
      toast.success(prevLiked ? "Post unliked." : "Post liked.");
    } catch (err) {
      syncPostCache(prevLiked, prevLikes, reposted, reposts);
      toast.error(err instanceof Error ? err.message : "Couldn't update like.");
      console.log(err);
    }
  };

  const handleRepost = async () => {
    const prevReposted = reposted;
    const prevReposts = reposts;
    const nextReposts = prevReposted
      ? Math.max(prevReposts - 1, 0)
      : prevReposts + 1;

    syncPostCache(liked, likes, !prevReposted, nextReposts);

    try {
      const res = await handleRepostAction(prevReposted);
      if (prevReposted) {
        if (isAlreadyRemoved(res)) {
          syncPostCache(liked, likes, false, Math.max(prevReposts - 1, 0));
        }
        toast.success("Repost removed.");
      } else {
        if (isAlreadyReposted(res)) {
          syncPostCache(liked, likes, prevReposted, prevReposts);
          toast.error("Already reposted.");
          return;
        }
        toast.success("Reposted.");
      }
    } catch (err) {
      syncPostCache(liked, likes, prevReposted, prevReposts);
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

    syncPostCache(liked, likes, true, prevReposts + 1);

    try {
      const res = await addRepost({ postId: data.id, content });
      if (isAlreadyReposted(res)) {
        syncPostCache(liked, likes, prevReposted, prevReposts);
        toast.error("Already reposted.");
        return;
      }
      toast.success("Quote reposted.");
    } catch (err) {
      syncPostCache(liked, likes, prevReposted, prevReposts);
      toast.error("Couldn't repost.");
      console.log(err);
    }
  };

  return (
    <div
      id={imageTargetId}
      className="px-7 container border-x-0 sm:border-x border border-muted py-6 bg-muted/50 sm:rounded-md sm:px-6"
    >
      <div className="flex justify-center gap-3">
        <Avatar
          className={cn({
            "avatar-shine": isOlderThanOneYear(author.createdAt),
          })}
        >
          <AvatarImage src={author.imageUrl ?? ""} alt="User avatar" />
          <AvatarFallback>
            <ScanFaceIcon />
          </AvatarFallback>
        </Avatar>

        <div className="flex justify-between w-full items-center text-[15px]">
          <div className="flex items-center space-x-1">
            <Link
              href={`/user/${author.username}`}
              className="font-semibold hover:underline"
            >
              {author.displayName}
            </Link>

            {isVerifiedUser(author.username) && (
              <BadgeCheckIcon className="w-4 h-4 text-pink-500" />
            )}
            <span className="text-muted-foreground">@{author.username}</span>
          </div>

          <div className="flex items-center gap-2 text-muted-foreground">
            <p className="text-muted-foreground text-xs">
              {shortTimeAgo(author.createdAt)}
            </p>
            {isAuthenticated && (
              <PostMenu
                postId={data.id}
                authorId={author.id}
                imageId={imageTargetId}
                isAuthenticated={!!isAuthenticated}
                currentUserId={currentUserId}
              />
            )}
          </div>
        </div>
      </div>

      <div className="text-[15px] w-full">
        <p className="mt-1">{data.content}</p>

        <div className="flex items-center space-x-4 text-muted-foreground mt-4">
          <button
            disabled={!isAuthenticated}
            type="button"
            onClick={handleLike}
            className={cn("flex space-x-1 items-center", {
              "text-pink-500": liked,
            })}
          >
            <HeartIcon
              className={cn("h-5 w-5", {
                "fill-pink-500": liked,
              })}
            />
            <span>{likes}</span>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                disabled={!isAuthenticated}
                type="button"
                className={cn("flex space-x-1 items-center", {
                  "text-emerald-600": reposted,
                })}
              >
                <Repeat2Icon
                  className={cn("h-5 w-5", {
                    "text-emerald-600": reposted,
                  })}
                />
                <span>{reposts}</span>
              </button>
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

          <div className="flex space-x-1 items-center">
            <MessageCircleIcon className="h-5 w-5" />
            <span>{data.commentCount}</span>
          </div>
        </div>
      </div>

      <RepostDialog
        open={repostDialogOpen}
        onOpenChange={setRepostDialogOpen}
        isAuthenticated={!!isAuthenticated}
        isReposted={reposted}
        onQuote={handleQuoteRepost}
      />
    </div>
  );
}
