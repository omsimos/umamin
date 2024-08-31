import Link from "next/link";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@umamin/ui/components/avatar";
import { cn } from "@umamin/ui/lib/utils";
import { Input } from "@umamin/ui/components/input";
import { shortTimeAgo } from "@umamin/shared/lib/utils";
import { BadgeCheck, Heart, MessageCircle, ScanFace } from "lucide-react";

type Props = {
  id: string;
  imageUrl: string;
  username: string;
  displayName: string;
  createdAt: number;
  content: string;
  isLiked: boolean;
  isVerified: boolean;
  likes: number;
  comments: number;
  className?: string;
  sessionImage?: string;
};

export function PostCard(props: Props) {
  return (
    <div
      className={cn(
        props.className,
        "flex space-x-3 container last-of-type:border-b-0 border-muted pb-6 text-[15px]"
      )}
    >
      <Avatar>
        <AvatarImage src={props.imageUrl} alt="User avatar" />
        <AvatarFallback>
          <ScanFace />
        </AvatarFallback>
      </Avatar>

      <div className=" w-full">
        <div className="flex justify-between">
          <div className="flex items-center space-x-1">
            <Link
              href={`/user/${props.username}`}
              className="font-semibold hover:underline"
            >
              {props.displayName}
            </Link>

            {props.isVerified && (
              <BadgeCheck className="w-4 h-4 text-pink-500" />
            )}
            <span className="text-muted-foreground">@{props.username}</span>
          </div>

          <p className="text-muted-foreground text-xs">
            {shortTimeAgo(props.createdAt)}
          </p>
        </div>

        <p className=" mt-1">{props.content}</p>

        <div className="flex items-center space-x-4 text-muted-foreground mt-4">
          <div
            className={cn("flex space-x-1 items-center", {
              "text-pink-500": props.isLiked,
            })}
          >
            <Heart
              className={cn("h-5 w-5", {
                "fill-pink-500": props.isLiked,
              })}
            />
            <span>{props.likes}</span>
          </div>

          <div className="flex space-x-1 items-center">
            <Link href={`/post/${props.id}`}>
              <MessageCircle className="h-5 w-5" />
            </Link>
            <span>{props.comments}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PostCardMain(props: Props) {
  return (
    <div className="px-7 container border-x-0 sm:border-x border border-muted py-6 bg-muted/50 sm:rounded-md sm:px-6">
      <div className="flex justify-center gap-3">
        <Avatar>
          <AvatarImage src={props.imageUrl} alt="User avatar" />
          <AvatarFallback>
            <ScanFace />
          </AvatarFallback>
        </Avatar>

        <div className="flex justify-between w-full items-center text-[15px]">
          <div className="flex items-center space-x-1">
            <Link
              href={`/user/${props.username}`}
              className="font-semibold hover:underline"
            >
              {props.displayName}
            </Link>

            {props.isVerified && (
              <BadgeCheck className="w-4 h-4 text-pink-500" />
            )}
            <span className="text-muted-foreground">@{props.username}</span>
          </div>

          <p className="text-muted-foreground text-xs">
            {shortTimeAgo(props.createdAt)}
          </p>
        </div>
      </div>

      <div className="text-[15px] w-full">
        <p className="mt-1">{props.content}</p>

        <div className="flex items-center space-x-4 text-muted-foreground mt-4">
          <div
            className={cn("flex space-x-1 items-center", {
              "text-pink-500": props.isLiked,
            })}
          >
            <Heart
              className={cn("h-5 w-5", {
                "fill-pink-500": props.isLiked,
              })}
            />
            <span>{props.likes}</span>
          </div>

          <div className="flex space-x-1 items-center">
            <Link href={`/post/${props.id}`}>
              <MessageCircle className="h-5 w-5" />
            </Link>
            <span>{props.comments}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PostCardWithComment(
  props: Props[] & { sessionImage?: string | null }
) {
  const tempData = { ...props[1]! };

  return (
    <div className="relative pb-6 border-b">
      <PostCard {...props[0]!} className="border-b-0 z-10 relative" />

      {/* <PostCard {...props[1]!} className="mt-6" /> */}
      <div className="h-[85%] w-[3px] absolute top-0 left-9 bg-muted" />

      <div
        className={cn(
          tempData.className,
          "flex space-x-3 container last-of-type:border-b-0 border-muted pb-6 text-[15px]"
        )}
      >
        <Avatar>
          <AvatarImage src={tempData.imageUrl} alt="User avatar" />
          <AvatarFallback>
            <ScanFace />
          </AvatarFallback>
        </Avatar>

        <div className="w-full bg-muted/50 p-4 rounded-md">
          <div className="flex justify-between">
            <div className="flex items-center space-x-1">
              <Link
                href={`/user/${tempData.username}`}
                className="font-semibold hover:underline"
              >
                {tempData.displayName}
              </Link>

              {tempData.isVerified && (
                <BadgeCheck className="w-4 h-4 text-pink-500" />
              )}
              <span className="text-muted-foreground">
                @{tempData.username}
              </span>
            </div>

            <p className="text-muted-foreground text-xs">
              {shortTimeAgo(tempData.createdAt)}
            </p>
          </div>

          <p className=" mt-1">{tempData.content}</p>

          <div className="flex items-center space-x-4 text-muted-foreground mt-4">
            <div
              className={cn("flex space-x-1 items-center", {
                "text-pink-500": tempData.isLiked,
              })}
            >
              <Heart
                className={cn("h-5 w-5", {
                  "fill-pink-500": tempData.isLiked,
                })}
              />
              <span>{tempData.likes}</span>
            </div>

            <div className="flex space-x-1 items-center">
              <Link href={`/post/${tempData.id}`}>
                <MessageCircle className="h-5 w-5" />
              </Link>
              <span>{tempData.comments}</span>
            </div>
          </div>
        </div>
      </div>

      <div className=" flex gap-2 w-full container">
        <Avatar>
          <AvatarImage src={props.sessionImage!} alt="User avatar" />
          <AvatarFallback>
            <ScanFace />
          </AvatarFallback>
        </Avatar>
        <Link
          href={`/post/${props[1]?.id}`}
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
