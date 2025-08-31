import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { shortTimeAgo } from "@/lib/utils";
import { SelectNote } from "@umamin/db/schema/note";
import { SelectUser } from "@umamin/db/schema/user";
import {
  ScanFaceIcon,
  BadgeCheckIcon,
  MessageCircleOffIcon,
  MessageSquareTextIcon,
} from "lucide-react";
import Link from "next/link";
import { ReplyDrawer } from "./reply-drawer";
import { useState } from "react";
import { Menu } from "@/components/menu";

type Props = {
  data: SelectNote & { user: SelectUser };
};

export function NoteCard({ data }: Props) {
  const user = data.user;
  const username = user.username;
  const [replyOpen, setReplyOpen] = useState(false);

  return (
    <div id={`umamin-${data.id}`}>
      <ReplyDrawer isOpen={replyOpen} setIsOpen={setReplyOpen} note={data} />

      <Card className="flex flex-col items-start justify-between">
        <CardHeader className="w-full pb-4 text-sm">
          <div className="flex justify-between items-start">
            <div className="flex gap-3">
              {data.isAnonymous ? (
                <Avatar>
                  <AvatarFallback>
                    <ScanFaceIcon />
                  </AvatarFallback>
                </Avatar>
              ) : (
                <Link href={`/user/${username}`} className="font-semibold">
                  <Avatar className="relative top-1">
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

              {data.user.quietMode && (
                <MessageCircleOffIcon className="size-4" />
              )}

              {!data.isAnonymous && !data.user.quietMode && (
                <button onClick={() => setReplyOpen((prev) => !prev)}>
                  <MessageSquareTextIcon className="size-5" />
                </button>
              )}

              <Menu
                menuItems={[
                  {
                    title: "Reply",
                    onClick: () => setReplyOpen(true),
                    disabled: data.user.quietMode,
                  },
                  {
                    title: "Save Image",
                    onClick: () => {
                      if (data.id) {
                        // onSaveImage(`umamin-${data.id}`);
                      }
                    },
                  },
                ]}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex w-full gap-3">
          <p className="whitespace-pre-wrap break-words min-w-0">
            {data.content}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
