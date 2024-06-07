"use client"

import Link from "next/link";
import { logEvent } from "firebase/analytics";
import { BadgeCheck, ScanFace } from "lucide-react";
import { formatDistanceToNow, fromUnixTime } from "date-fns";

import { Menu, type MenuItems } from "@/app/components/menu";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@umamin/ui/components/avatar";
import { onSaveImage } from "@/lib/utils";
import { analytics } from "@/lib/firebase";
import { NoteQueryResult } from "../queries";
import { Icons } from "@/app/components/utilities/icons";
import { Card, CardContent, CardHeader } from "@umamin/ui/components/card";

type Props = {
  note: Partial<NoteQueryResult>;
  menuItems?: MenuItems;
};

export function NoteCard({ note, menuItems }: Props) {
  const username = note.user?.username;

  return (
    <div id={note.id}>
      <Card className="flex flex-col items-start justify-between">
        <CardHeader className="w-full">
          <div className="flex justify-between items-start">
            <div className="flex gap-4">
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
                      src={note.user?.imageUrl ?? ""}
                      alt="User avatar"
                    />
                    <AvatarFallback className="text-xs">
                      {note.user?.username[0]}
                    </AvatarFallback>
                  </Avatar>
                </Link>
              )}

              <div className="flex flex-col">
                {note.isAnonymous ? (
                  <p className="text-muted-foreground font-semibold">
                    anonymous
                  </p>
                ) : (
                  <div className="flex items-center space-x-1">
                    <Link
                      href={`/user/${username}`}
                      className="font-semibold hover:underline"
                    >
                      {username}
                    </Link>
                    {username &&
                      process.env.NEXT_PUBLIC_VERIFIED_USERS?.split(
                        ",",
                      ).includes(username) && (
                        <BadgeCheck className="w-4 h-4 text-pink-500" />
                      )}
                  </div>
                )}

                {note.updatedAt && (
                  <p className="text-sm text-muted-foreground">
                    {formatDistanceToNow(fromUnixTime(note.updatedAt), {
                      addSuffix: true,
                    })}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-x-1 text-muted-foreground items-center">
              {!note.isAnonymous && (
                <Link href={`/to/${username}`} className="hover:underline">
                  <Icons.chat className="h-5 w-5" />
                </Link>
              )}

              <Menu
                menuItems={[
                  ...(menuItems ?? []),
                  {
                    title: "Save Image",
                    onClick: () => {
                      if (note.id) {
                        onSaveImage(note.id);
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