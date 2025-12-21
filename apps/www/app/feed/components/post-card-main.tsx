"use client";

import { useAsyncRateLimitedCallback } from "@tanstack/react-pacer/async-rate-limiter";
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
  addLikeAction,
  addRepostAction,
  removeLikeAction,
  removeRepostAction,
} from "@/app/actions/post";
import { isAlreadyRemoved, isAlreadyReposted, shortTimeAgo } from "@/lib/utils";
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
  const [liked, setLiked] = useState<boolean>(data.isLiked === true);
  const [likes, setLikes] = useState<number>(data.likeCount ?? 0);
  const [reposted, setReposted] = useState<boolean>(data.isReposted === true);
  const [reposts, setReposts] = useState<number>(data.repostCount ?? 0);
  const [repostDialogOpen, setRepostDialogOpen] = useState(false);

  useEffect(() => {
    setLiked(data.isLiked === true);
    setLikes(data.likeCount ?? 0);
    setReposted(data.isReposted === true);
    setReposts(data.repostCount ?? 0);
  }, [data.isLiked, data.likeCount, data.isReposted, data.repostCount]);

  const rateLimitedLike = useAsyncRateLimitedCallback(
    async (prevLiked: boolean) =>
      prevLiked
        ? removeLikeAction({ postId: data.id })
        : addLikeAction({ postId: data.id }),
    {
      limit: 6,
      window: 10000,
      windowType: "sliding",
      onReject: () => {
        throw new Error("You're tapping too fast. Please wait a moment.");
      },
    },
  );

  const rateLimitedRepost = useAsyncRateLimitedCallback(
    async (prevReposted: boolean) =>
      prevReposted
        ? removeRepostAction({ postId: data.id })
        : addRepostAction({ postId: data.id }),
    {
      limit: 4,
      window: 10000,
      windowType: "sliding",
      onReject: () => {
        throw new Error("You're reposting too fast. Please wait a moment.");
      },
    },
  );

  const handleLike = async () => {
    const prevLiked = liked;
    const prevLikes = likes;

    setLiked(!prevLiked);
    setLikes((v) => (prevLiked ? Math.max(v - 1, 0) : v + 1));

    try {
      await rateLimitedLike(prevLiked);
      toast.success(prevLiked ? "Post unliked" : "Post liked successfully!");
    } catch (err) {
      // rollback state
      setLiked(prevLiked);
      setLikes(prevLikes);
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to update like. Please try again.",
      );
      console.log(err);
    }
  };

  const handleRepost = async () => {
    const prevReposted = reposted;
    const prevReposts = reposts;

    setReposted(!prevReposted);
    setReposts((v) => (prevReposted ? Math.max(v - 1, 0) : v + 1));

    try {
      const res = await rateLimitedRepost(prevReposted);
      if (prevReposted) {
        if (isAlreadyRemoved(res)) {
          setReposted(false);
          setReposts((v) => Math.max(v - 1, 0));
        }
        toast.success("Repost removed");
      } else {
        if (isAlreadyReposted(res)) {
          setReposted(prevReposted);
          setReposts(prevReposts);
          toast.error("You already reposted this.");
          return;
        }
        toast.success("Reposted");
      }
    } catch (err) {
      setReposted(prevReposted);
      setReposts(prevReposts);
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to update repost. Please try again.",
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
      if (isAlreadyReposted(res)) {
        setReposted(prevReposted);
        setReposts(prevReposts);
        toast.error("You already reposted this.");
        return;
      }
      toast.success("Quote reposted");
    } catch (err) {
      setReposted(prevReposted);
      setReposts(prevReposts);
      toast.error("Failed to repost. Please try again.");
      console.log(err);
    }
  };

  return (
    <div
      id={imageTargetId}
      className="px-7 container border-x-0 sm:border-x border border-muted py-6 bg-muted/50 sm:rounded-md sm:px-6"
    >
      <div className="flex justify-center gap-3">
        <Avatar>
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

            {/* {author.isVerified && ( */}
            {/*   <BadgeCheckIcon className="w-4 h-4 text-pink-500" /> */}
            {/* )} */}
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
