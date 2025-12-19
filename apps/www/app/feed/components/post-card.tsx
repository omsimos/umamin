"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@umamin/ui/components/avatar";
import { cn } from "@umamin/ui/lib/utils";
import { HeartIcon, MessageCircleIcon, ScanFaceIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  addCommentLikeAction,
  addLikeAction,
  removeCommentLikeAction,
  removeLikeAction,
} from "@/app/actions/post";
import { shortTimeAgo } from "@/lib/utils";
import type { PostData } from "@/types/post";

type Props = {
  isComment?: boolean;
  className?: string;
  data: PostData;
};

export function PostCard({ data, isComment, className }: Props) {
  const author = data?.author;
  const [liked, setLiked] = useState<boolean>(data.isLiked === true);
  const [upvotes, setUpvotes] = useState<number>(data.upvoteCount ?? 0);

  useEffect(() => {
    setLiked(data.isLiked === true);
    setUpvotes(data.upvoteCount ?? 0);
  }, [data.isLiked, data.upvoteCount]);

  const handleLike = async () => {
    const prevLiked = liked;
    const prevUpvotes = upvotes;

    setLiked(!prevLiked);
    setUpvotes((v) => (prevLiked ? Math.max(v - 1, 0) : v + 1));

    try {
      if (isComment) {
        if (prevLiked) {
          await removeCommentLikeAction({ commentId: data.id });
          toast.success("Comment unliked");
        } else {
          await addCommentLikeAction({ commentId: data.id });
          toast.success("Comment liked successfully!");
        }
      } else {
        if (prevLiked) {
          await removeLikeAction({ postId: data.id });
          toast.success("Post unliked");
        } else {
          await addLikeAction({ postId: data.id });
          toast.success("Post liked successfully!");
        }
      }
    } catch (err) {
      setLiked(prevLiked);
      setUpvotes(prevUpvotes);
      toast.error("Failed to update like. Please try again.");
      console.log(err);
    }
  };

  return (
    <div
      className={cn(
        className,
        "flex space-x-3 container last-of-type:border-b-0 border-muted pb-6 text-[15px]",
      )}
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

          {data?.createdAt && (
            <p className="text-muted-foreground text-xs">
              {shortTimeAgo(data.createdAt)}
            </p>
          )}
        </div>

        <p className=" mt-1">{data?.content}</p>

        <div className="flex items-center space-x-4 text-muted-foreground mt-4">
          <button
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
            <span>{upvotes}</span>
          </button>

          {!isComment && (
            <div className="flex space-x-1 items-center">
              <Link href={`/post/${data?.id}`}>
                <MessageCircleIcon className="h-5 w-5" />
              </Link>
              <span>{data.commentCount}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
