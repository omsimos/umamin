import { formatDistanceToNow } from "date-fns";
import { BadgeCheck, CalendarDays, MessageCircleOff } from "lucide-react";

import { ShareButton } from "./share-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import CopyLink from "./copy-link";
import { getSession } from "@/lib/auth";

export async function UserCard() {
  const { user } = await getSession();

  if (!user) {
    return null;
  }

  return (
    <div>
      <section className="flex gap-4">
        <Avatar className="md:h-20 md:w-20 h-16 w-16">
          <AvatarImage
            className="rounded-full"
            src={user?.imageUrl ?? ""}
            alt={`${user?.username}'s avatar`}
          />
          <AvatarFallback className="md:text-4xl text-xl">
            {user?.username?.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div>
          <div className="flex items-center gap-2">
            <div className="flex items-center space-x-1">
              <p className="font-semibold md:text-xl">
                {user.displayName ? user.displayName : user.username}
              </p>
              {process.env.NEXT_PUBLIC_VERIFIED_USERS?.split(",").includes(
                user.username,
              ) && <BadgeCheck className="w-4 h-4 text-pink-500" />}
              {user.quietMode && (
                <MessageCircleOff className="h-4 w-4 mr-2 text-sm text-yellow-500" />
              )}
            </div>

            <ShareButton username={user.username} />
          </div>
          <p data-testid="username" className="text-muted-foreground text-sm">
            @{user.username}
          </p>
        </div>
      </section>

      <section className="mt-4">
        <p
          className={cn("min-w-0 text-sm break-words", {
            "break-all": user?.bio?.split(" ").length === 1,
          })}
        >
          {user?.bio}
        </p>

        <div className="mt-4 space-y-1">
          <CopyLink username={user.username} />

          <div className="text-muted-foreground text-sm flex items-center">
            <CalendarDays className="h-4 w-4 mr-2" />
            Joined{" "}
            {formatDistanceToNow(user.createdAt, {
              addSuffix: true,
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
