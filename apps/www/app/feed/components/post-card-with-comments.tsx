import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@umamin/ui/components/avatar";
import { Input } from "@umamin/ui/components/input";
import { cn } from "@umamin/ui/lib/utils";
import { HeartIcon, MessageCircleIcon, ScanFaceIcon } from "lucide-react";
import Link from "next/link";
import { shortTimeAgo } from "@/lib/utils";
import type { PostData } from "@/types/post";
import { PostCard } from "./post-card";

type Props = {
  data: PostData;
};

export function PostCardWithComments({ data }: Props) {
  const author = data.author;

  return (
    <div className="relative pb-6 border-b">
      <PostCard data={data} className="border-b-0 z-10 relative" />

      {/* <PostCard {...author[1]!} className="mt-6" /> */}
      <div className="h-[85%] w-0.75 absolute top-0 left-9 bg-muted" />

      <div
        className={cn(
          "flex space-x-3 container last-of-type:border-b-0 border-muted pb-6 text-[15px]",
        )}
      >
        <Avatar>
          <AvatarImage src={author.imageUrl ?? ""} alt="User avatar" />
          <AvatarFallback>
            <ScanFaceIcon />
          </AvatarFallback>
        </Avatar>

        <div className="w-full bg-muted/50 p-4 rounded-md">
          <div className="flex justify-between">
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

          <p className=" mt-1">{data.content}</p>

          <div className="flex items-center space-x-4 text-muted-foreground mt-4">
            <div
              className={cn("flex space-x-1 items-center", {
                // "text-pink-500": author.isLiked,
                "text-pink-500": false,
              })}
            >
              <HeartIcon
                className={cn("h-5 w-5", {
                  // "fill-pink-500": author.isLiked,
                  "fill-pink-500": false,
                })}
              />
              <span>{data.likeCount}</span>
            </div>

            <div className="flex space-x-1 items-center">
              <Link href={`/post/${author.id}`}>
                <MessageCircleIcon className="h-5 w-5" />
              </Link>
              <span>{data.commentCount}</span>
            </div>
          </div>
        </div>
      </div>

      <div className=" flex gap-2 w-full container">
        <Avatar>
          <AvatarImage src={author.imageUrl ?? ""} alt="User avatar" />
          <AvatarFallback>
            <ScanFaceIcon />
          </AvatarFallback>
        </Avatar>
        <Link
          href={`/post/${data.id}`}
          className="items-center space-x-2 w-full self-center cursor-pointer"
        >
          <Input
            id="message"
            required
            maxLength={500}
            placeholder="Leave a reply..."
            className="pointer-events-none focus-visible:ring-transparent text-sm rounded-full bg-muted/50 caret-pink-300"
            autoComplete="off"
          />
          <p className="text-muted-foreground text-sm mt-2">
            View more comments
          </p>
        </Link>
      </div>
    </div>
  );
}
