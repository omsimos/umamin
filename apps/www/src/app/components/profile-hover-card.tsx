"use client";

import Link from "next/link";
import { toast } from "sonner";
import { CalendarDays, ScanFace } from "lucide-react";
import { Button } from "@umamin/ui/components/button";

import {
  Avatar,
  //   AvatarImage,
  AvatarFallback,
} from "@umamin/ui/components/avatar";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@umamin/ui/components/hover-card";

// import { format } from "date-fns";

type User = {
  name: string;
  slug: string;
  id: string;
  //   image: string;
  createdAt: string;
};

type ProfileHoverCardProps = {
  children: React.ReactNode;
  user: User;
  sessionId: string | undefined;
};

export function ProfileHoverCard({
  children,
  user,
  sessionId,
}: ProfileHoverCardProps) {
  const userSlug = user.slug ? "@" + user.slug : user.id;

  return (
    <HoverCard openDelay={300}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent className="w-80">
        <div className="flex items justify-between space-x-4">
          <div className="space-y-1">
            <div>
              <h4 className="text-lg font-semibold">{user.name}</h4>
              {user.slug && (
                <Link
                  href={`/user/${userSlug}`}
                  className="text-sm font-normal text-zinc-200"
                >
                  {"@" + user.slug}
                </Link>
              )}
            </div>
            <div className="flex items-center">
              <CalendarDays className="mr-1 h-3 w-3 text-muted-foreground" />{" "}
              <span className="text-xs text-muted-foreground">
                {/* Joined {format(new Date(user.createdAt), "MMMM yyyy")} */}
                Joined March 19, 2024
              </span>
            </div>
          </div>

          <Link href={`/user/${userSlug}`} className="font-semibold">
            {/* <Avatar className="h-16 w-16">
              <AvatarImage
                className="rounded-full"
                src={user.image as string | undefined}
                alt={`${user.name}'s avatar`}
              />
              <AvatarFallback className="text-xs">
                {user.name?.split(" ").at(0)}
              </AvatarFallback>
            </Avatar> */}
            <Avatar className="h-16 w-16">
              <AvatarFallback>
                <ScanFace />
              </AvatarFallback>
            </Avatar>
          </Link>
        </div>
        <p className="text-muted-foreground text-sm mt-3">
          The quick brown fox jumps over the lazy dog near the bank of the
          river🦊
        </p>
        {user.id !== sessionId && (
          <Button
            title="follow"
            onClick={() => toast.info("Feature coming soon!")}
            className="mt-4 w-full"
          >
            Follow
          </Button>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
