import Link from "next/link";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@umamin/ui/components/avatar";
import { cn } from "@umamin/ui/lib/utils";
import { shortTimeAgo } from "@/lib/utils";
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
};

export function PostCard(props: Props) {
  return (
    <div className="flex space-x-3 sm:px-0 container border-b border-muted pb-6">
      <Avatar>
        <AvatarImage src={props.imageUrl} alt="User avatar" />
        <AvatarFallback>
          <ScanFace />
        </AvatarFallback>
      </Avatar>

      <div className="text-sm w-full">
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

        <p className="text-sm mt-1">{props.content}</p>

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
    <div className="container border border-muted py-6 bg-card rounded-md sm:px-6">
      <div className="flex justify-center gap-3">
        <Avatar>
          <AvatarImage src={props.imageUrl} alt="User avatar" />
          <AvatarFallback>
            <ScanFace />
          </AvatarFallback>
        </Avatar>

        <div className="flex justify-between w-full items-center text-sm">
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

      <div className="text-sm w-full">
        <p className="text-sm mt-1">{props.content}</p>

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
