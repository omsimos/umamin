"use client";

import { useAsyncRateLimitedCallback } from "@tanstack/react-pacer/async-rate-limiter";
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
import { isAlreadyRemoved, isAlreadyReposted, shortTimeAgo } from "@/lib/utils";
import type { CommentData, PostData } from "@/types/post";
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

  useEffect(() => {
    setLiked(data.isLiked === true);
    setLikes(data.likeCount ?? 0);
    setReposted("isReposted" in data ? data.isReposted === true : false);
    setReposts("repostCount" in data ? (data.repostCount ?? 0) : 0);
  }, [data.isLiked, data.likeCount, data]);

  const rateLimitedLike = useAsyncRateLimitedCallback(
    async (prevLiked: boolean) => {
      if (isComment) {
        return prevLiked
          ? removeCommentLikeAction({
              commentId: data.id,
              postId: commentPostId,
            })
          : addCommentLikeAction({
              commentId: data.id,
              postId: commentPostId,
            });
      }

      return prevLiked
        ? removeLikeAction({ postId: data.id })
        : addLikeAction({ postId: data.id });
    },
    {
      limit: 4,
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
      if (isComment) {
        toast.success(
          prevLiked ? "Comment unliked" : "Comment liked successfully!",
        );
      } else {
        toast.success(prevLiked ? "Post unliked" : "Post liked successfully!");
      }
    } catch (err) {
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
        queryClient.invalidateQueries({ queryKey: ["posts"] });
      } else {
        if (isAlreadyReposted(res)) {
          setReposted(prevReposted);
          setReposts(prevReposts);
          toast.error("You already reposted this.");
          return;
        }
        toast.success("Reposted");
        queryClient.invalidateQueries({ queryKey: ["posts"] });
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
      queryClient.invalidateQueries({ queryKey: ["posts"] });
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
      className={cn(className, "flex space-x-3 container text-[15px]", {
        "border-b pb-6": !isRepost,
        "border border-muted rounded-md px-2 py-3 sm:px-4": isRepost,
      })}
    >
      <Avatar>
        <AvatarImage src={author?.imageUrl ?? ""} alt="User avatar" />
        <AvatarFallback>
          <ScanFaceIcon />
        </AvatarFallback>
      </Avatar>

      <div className=" w-full">
        <div className="flex justify-between">
          <div className="flex items-center space-x-1">
            <Link
              href={`/user/${author?.username}`}
              className="font-semibold hover:underline"
            >
              {author?.displayName}
            </Link>

            {/* {author?.isVerified && ( */}
            {/*   <BadgeCheckIcon className="w-4 h-4 text-pink-500" /> */}
            {/* )} */}
            <span className="text-muted-foreground">@{author?.username}</span>
          </div>

          <div className="flex items-center gap-2 text-muted-foreground">
            {data?.createdAt && (
              <p className="text-muted-foreground text-xs">
                {shortTimeAgo(data.createdAt)}
              </p>
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
          </div>
        </div>

        <p className=" mt-1">{data?.content}</p>

        <div className="flex items-center space-x-4 text-muted-foreground mt-4">
          <button
            type="button"
            disabled={!isAuthenticated}
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

          {!isComment && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  disabled={!isAuthenticated}
                  className={cn("flex space-x-1 items-center", {
                    "text-emerald-600": reposted,
                  })}
                >
                  <Repeat2Icon
                    className={cn("size-6", {
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
          )}

          {!isComment && (
            <div className="flex space-x-1 items-center">
              <Link href={`/post/${data?.id}`}>
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
