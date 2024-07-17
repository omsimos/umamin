"use client";

import Link from "next/link";
import { useState } from "react";
import { logEvent } from "firebase/analytics";
import { BadgeCheck, ScanFace } from "lucide-react";

import { analytics } from "@/lib/firebase";
import { CurrentNoteQueryResult } from "../queries";
import { Icons } from "@/app/components/utilities/icons";
import { Menu, type MenuItems } from "@/app/components/menu";
import { Card, CardContent, CardHeader } from "@umamin/ui/components/card";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@umamin/ui/components/avatar";
import { onSaveImage, shortTimeAgo } from "@/lib/utils";

type Props = {
  note: NonNullable<CurrentNoteQueryResult>;
  user?: {
    id?: string;
    displayName?: string | null;
    username?: string;
    imageUrl?: string | null;
  };
  menuItems?: MenuItems;
  currentUserId?: string;
};

export function NoteCard({ note, user, menuItems, currentUserId }: Props) {
  const [open, setOpen] = useState(false);
  const username = user?.username;

  return (
    <div id={`umamin-${note.id}`} className="container">
      <Card className="flex flex-col items-start justify-between">
        <CardHeader className="w-full pb-4 text-sm">
          <div className="flex justify-between items-start">
            <div className="flex gap-3">
              {note.isAnonymous ? (
                <Avatar>
                  <AvatarFallback>
                    <ScanFace />
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
                      <ScanFace />
                    </AvatarFallback>
                  </Avatar>
                </Link>
              )}

              <div className="flex flex-col mt-1">
                {note.isAnonymous ? (
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
                        ","
                      ).includes(username) && (
                        <BadgeCheck className="w-4 h-4 text-pink-500" />
                      )}
                  </Link>
                )}

                {!note.isAnonymous && (
                  <span className="text-muted-foreground truncate">
                    @{username}
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-x-1 text-muted-foreground items-center">
              {note.updatedAt && (
                <span className="text-xs text-muted-foreground mr-1">
                  {shortTimeAgo(note.updatedAt)}
                </span>
              )}

              {currentUserId && !note.isAnonymous && (
                <button onClick={() => setOpen(!open)}>
                  <Icons.chat className="h-5 w-5" />
                </button>
              )}

              <Menu
                menuItems={[
                  ...(menuItems ?? []),
                  {
                    title: "Save Image",
                    onClick: () => {
                      if (note.id) {
                        onSaveImage(`umamin-${note.id}`);
                        logEvent(analytics, "save_image_note");
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
            {note.content}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
