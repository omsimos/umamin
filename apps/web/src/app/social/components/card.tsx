import Link from "next/link";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@umamin/ui/components/avatar";
import {
  BadgeCheck,
  Ellipsis,
  Heart,
  MessageCircle,
  ScanFace,
} from "lucide-react";
import { formatDistanceToNow, fromUnixTime } from "date-fns";
import { cn } from "@umamin/ui/lib/utils";

type Props = {
  imageUrl: string;
  username: string;
  createdAt: number;
  content: string;
  isLiked: boolean;
  isVerified: boolean;
  likes: number;
  comments: number;
};

export function SocialCard(props: Props) {
  return (
    <div className="flex space-x-3 sm:px-0 container border-b border-b-muted pb-6">
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
              {props.username}
            </Link>

            {props.isVerified && (
              <BadgeCheck className="w-4 h-4 text-pink-500" />
            )}

            <p className="text-muted-foreground">
              {formatDistanceToNow(fromUnixTime(props.createdAt), {
                addSuffix: true,
              })}
            </p>
          </div>

          <Ellipsis className="h-5 w-5 text-muted-foreground" />
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
            <MessageCircle className="h-5 w-5" />
            <span>{props.comments}</span>
          </div>
        </div>
      </div>
    </div>
  );
}