import { formatDistanceToNow } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@umamin/ui/components/tooltip";
// import { ProfileDropdownMenu } from "./profile-dropdown-menu";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@umamin/ui/components/avatar";

import { Icons } from "../../components/utilities/icons";
import type { SelectUser } from "@umamin/server/db/schema";
import { Card, CardHeader } from "@umamin/ui/components/card";

export function UserCard({ ...user }: SelectUser) {
  return (
    <Card className="bg-background">
      <CardHeader className="rounded-2xl">
        <div className="flex justify-between py-5">
          <div className="flex gap-6 items-center">
            <Avatar className="h-28 w-28">
              <AvatarImage
                className="rounded-full"
                src={user?.imageUrl}
                alt={`${user?.username}'s avatar`}
              />
              <AvatarFallback className="text-xs">
                {user?.username?.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xl">@{user?.username}</span>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button>
                        <Icons.link className="h-4 text-muted-foreground" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Copy profile url</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-muted-foreground text-sm mt-1">
                Joined{" "}
                {formatDistanceToNow(new Date(user?.createdAt ?? ""), {
                  addSuffix: true,
                })}
              </p>

              {/* <p
              className={cn("mt-3 text-sm break-words", {
                "break-all": user?.bio?.split(" ").length === 1,
              })}
            >
              {user?.bio}
            </p> */}
              <p className="mt-3 break-words text-muted-foreground">
                Hello! I'm the qiuck brown fox who jumped on the lazy dog near
                the bank of the river. 🦊
              </p>
            </div>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
