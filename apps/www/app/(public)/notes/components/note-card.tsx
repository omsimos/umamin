import type { SelectNote } from "@umamin/db/schema/note";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@umamin/ui/components/avatar";
import { Button } from "@umamin/ui/components/button";
import { Card, CardContent, CardHeader } from "@umamin/ui/components/card";
import { cn } from "@umamin/ui/lib/utils";
import {
  BadgeCheckIcon,
  DownloadIcon,
  MessageSquareTextIcon,
  MessageSquareXIcon,
  ScanFaceIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Menu } from "@/components/menu";
import { isOlderThanOneYear, saveImage, shortTimeAgo } from "@/lib/utils";
import type { PublicUser } from "@/types/user";
import { ReplyDrawer } from "./reply-drawer";

type Props = {
  data: SelectNote & { user?: PublicUser };
  isAuthenticated: boolean;
  index?: number;
};

export function NoteCard({ data, isAuthenticated, index = 0 }: Props) {
  const user = data.user;
  const username = user?.username;
  const [replyOpen, setReplyOpen] = useState(false);

  return (
    // Tilt lives outside the export element so saved images stay straight.
    <div
      className={cn(
        "transition-transform duration-300 hover:rotate-0",
        index % 2 === 0 ? "rotate-[0.5deg]" : "-rotate-[0.5deg]",
      )}
    >
      <div id={`umamin-${data.id}`}>
        {isAuthenticated && !data.isAnonymous && user && (
          <ReplyDrawer
            isOpen={replyOpen}
            setIsOpen={setReplyOpen}
            note={{ ...data, user }}
          />
        )}

        <Card
          className={cn(
            "flex flex-col items-start justify-between",
            data.isAnonymous && "border-dashed",
          )}
        >
          <CardHeader className="w-full text-sm">
            <div className="flex justify-between items-start">
              <div className="flex gap-3">
                {data.isAnonymous ? (
                  <Avatar>
                    <AvatarFallback>
                      <ScanFaceIcon />
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <Link
                    href={`/user/${username}`}
                    className="font-semibold relative"
                  >
                    <Avatar
                      className={cn({
                        "avatar-shine": isOlderThanOneYear(user?.createdAt),
                      })}
                    >
                      <AvatarImage
                        className="rounded-full"
                        src={user?.imageUrl ?? ""}
                        alt="User avatar"
                      />
                      <AvatarFallback className="text-xs">
                        <ScanFaceIcon />
                      </AvatarFallback>
                    </Avatar>
                  </Link>
                )}

                <div className="flex flex-col mt-1">
                  {data.isAnonymous ? (
                    <span className="text-muted-foreground text-base font-semibold leading-normal">
                      anonymous
                    </span>
                  ) : (
                    <Link
                      href={`/user/${username}`}
                      className="flex items-center space-x-1"
                    >
                      <span className="font-semibold flex-none text-base leading-none">
                        {user?.displayName ? user.displayName : user?.username}
                      </span>
                      {username &&
                        process.env.NEXT_PUBLIC_VERIFIED_USERS?.split(
                          ",",
                        ).includes(username) && (
                          <BadgeCheckIcon className="w-4 h-4 text-pink-500" />
                        )}
                    </Link>
                  )}

                  {!data.isAnonymous && (
                    <span className="text-muted-foreground truncate">
                      @{username}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-x-1 text-muted-foreground items-center">
                {data.updatedAt && (
                  <span className="text-xs text-muted-foreground mr-1">
                    {shortTimeAgo(data.updatedAt)}
                  </span>
                )}

                {user?.quietMode && <MessageSquareXIcon className="size-5" />}

                {isAuthenticated && !data.isAnonymous && !user?.quietMode && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Reply"
                    aria-expanded={replyOpen}
                    onClick={() => setReplyOpen((prev) => !prev)}
                    className="size-auto p-0 hover:bg-transparent text-muted-foreground"
                  >
                    <MessageSquareTextIcon className="size-5" />
                  </Button>
                )}

                {isAuthenticated && (
                  <Menu
                    menuItems={[
                      {
                        title: "Reply",
                        onClick: () => setReplyOpen(true),
                        disabled: data.isAnonymous || !!user?.quietMode,
                        icon: <MessageSquareTextIcon className="h-4 w-4" />,
                      },
                      {
                        title: "Save Image",
                        onClick: () => saveImage(`umamin-${data.id}`),
                        icon: <DownloadIcon className="h-4 w-4" />,
                      },
                    ]}
                  />
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex w-full gap-3">
            <p className="min-w-0 whitespace-pre-wrap break-words font-display text-lg leading-snug">
              {data.content}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
