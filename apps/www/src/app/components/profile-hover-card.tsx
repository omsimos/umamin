"use client";

import Link from "next/link";
import { toast } from "sonner";
import { CalendarDays } from "lucide-react";
import { formatDistanceToNow, fromUnixTime } from "date-fns";
import { Button } from "@umamin/ui/components/button";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@umamin/ui/components/avatar";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@umamin/ui/components/hover-card";

type Props = {
  children: React.ReactNode;
  user: {
    username: string;
    imageUrl?: string | null;
    createdAt: number;
  };
};

export function ProfileHoverCard({ children, user }: Props) {
  return (
    <HoverCard openDelay={300}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent className="w-80">
        <div className="flex items justify-between space-x-4">
          <div className="space-y-1">
            <div>
              <h4 className="text-lg font-semibold">{user.username}</h4>
              {user.username && (
                <Link
                  href={`/user/${user.username}`}
                  className="text-sm font-normal text-muted-foreground"
                >
                  {"@" + user.username}
                </Link>
              )}
            </div>
            <div className="flex items-center">
              <CalendarDays className="mr-1 h-3 w-3 text-muted-foreground" />{" "}
              <span className="text-xs text-muted-foreground">
                Joined{" "}
                {formatDistanceToNow(fromUnixTime(user.createdAt), {
                  addSuffix: true,
                })}
              </span>
            </div>
          </div>

          <Link href={`/user/${user.username}`} className="font-semibold">
            <Avatar className="h-16 w-16">
              <AvatarImage
                className="rounded-full"
                src={user.imageUrl ?? ""}
                alt={`${user.username}'s avatar`}
              />
              <AvatarFallback className="text-xs">
                {user.username?.split(" ").at(0)}
              </AvatarFallback>
            </Avatar>
          </Link>
        </div>
        <p className="text-muted-foreground text-sm mt-3">
          The quick brown fox jumps over the lazy dog near the bank of the
          river🦊
        </p>
        <Button
          title="Visit Profile"
          onClick={() => toast.info("Feature coming soon!")}
          className="mt-4 w-full"
        >
          Visit Profile
        </Button>
      </HoverCardContent>
    </HoverCard>
  );
}
