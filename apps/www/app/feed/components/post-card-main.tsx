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
import { addLikeAction, removeLikeAction } from "@/app/actions/post";
import { shortTimeAgo } from "@/lib/utils";
import type { PostData } from "@/types/post";

type Props = {
  data: PostData;
};

export function PostCardMain({ data }: Props) {
  const author = data.author;
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
      if (prevLiked) {
        await removeLikeAction({ postId: data.id });
        toast.success("Post unliked");
      } else {
        await addLikeAction({ postId: data.id });
        toast.success("Post liked successfully!");
      }
    } catch (err) {
      // rollback state
      setLiked(prevLiked);
      setUpvotes(prevUpvotes);
      toast.error("Failed to update like. Please try again.");
      console.log(err);
    }
  };

  return (
    <div className="px-7 container border-x-0 sm:border-x border border-muted py-6 bg-muted/50 sm:rounded-md sm:px-6">
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

          <p className="text-muted-foreground text-xs">
            {shortTimeAgo(author.createdAt)}
          </p>
        </div>
      </div>

      <div className="text-[15px] w-full">
        <p className="mt-1">{data.content}</p>

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

          <div className="flex space-x-1 items-center">
            <Link href={`/post/${author.id}`}>
              <MessageCircleIcon className="h-5 w-5" />
            </Link>
            <span>{data.commentCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
