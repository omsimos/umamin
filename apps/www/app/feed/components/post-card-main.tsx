"use client";

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
  Repeat2Icon,
  ScanFaceIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  addLikeAction,
  addRepostAction,
  removeLikeAction,
  removeRepostAction,
} from "@/app/actions/post";
import { isAlreadyRemoved, isAlreadyReposted, shortTimeAgo } from "@/lib/utils";
import type { PostData } from "@/types/post";
import { RepostDialog } from "./repost-dialog";

type Props = {
  data: PostData;
  isAuthenticated?: boolean;
};

export function PostCardMain({ data, isAuthenticated }: Props) {
  const author = data.author;
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

  const handleLike = async () => {
    const prevLiked = liked;
    const prevLikes = likes;

    setLiked(!prevLiked);
    setLikes((v) => (prevLiked ? Math.max(v - 1, 0) : v + 1));

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
      setLikes(prevLikes);
      toast.error("Failed to update like. Please try again.");
      console.log(err);
    }
  };

  const handleRepost = async () => {
    const prevReposted = reposted;
    const prevReposts = reposts;

    setReposted(!prevReposted);
    setReposts((v) => (prevReposted ? Math.max(v - 1, 0) : v + 1));

    try {
      if (prevReposted) {
        const res = await removeRepostAction({ postId: data.id });
        if (isAlreadyRemoved(res)) {
          setReposted(false);
          setReposts((v) => Math.max(v - 1, 0));
        }
        toast.success("Repost removed");
      } else {
        const res = await addRepostAction({ postId: data.id });
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
      toast.error("Failed to update repost. Please try again.");
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
                {reposted ? "Remove repost" : "Repost"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setRepostDialogOpen(true);
                }}
                disabled={reposted}
              >
                Quote
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
