import Link from "next/link";
import { BadgeCheck, ScanFace } from "lucide-react";
import { formatDistanceToNow, fromUnixTime } from "date-fns";

import { Menu, type MenuItems } from "@/app/components/menu";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@umamin/ui/components/avatar";
import { Icons } from "@/app/components/utilities/icons";
import { Card, CardContent, CardHeader } from "@umamin/ui/components/card";

type Props = {
  username: string;
  imageUrl?: string | null;
  updatedAt?: number | null;
  isAnonymous?: boolean;
  note: string;
  menuItems?: MenuItems;
};

export function NoteCard({
  username,
  isAnonymous,
  updatedAt,
  imageUrl,
  note,
  menuItems,
}: Props) {
  return (
    <Card className="flex flex-col items-start justify-between">
      <CardHeader className="w-full">
        <div className="flex justify-between items-start">
          <div className="flex gap-4">
            {isAnonymous ? (
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
                    src={imageUrl ?? ""}
                    alt="User avatar"
                  />
                  <AvatarFallback className="text-xs">
                    {username[0]}
                  </AvatarFallback>
                </Avatar>
              </Link>
            )}

            <div className="flex flex-col">
              {isAnonymous ? (
                <p className="text-muted-foreground font-semibold">anonymous</p>
              ) : (
                <div className="flex items-center space-x-1">
                  <Link
                    href={`/user/${username}`}
                    className="font-semibold hover:underline"
                  >
                    {username}
                  </Link>
                  {process.env.NEXT_PUBLIC_VERIFIED_USERS?.split(",").includes(
                    username,
                  ) && <BadgeCheck className="w-4 h-4 text-pink-500" />}
                </div>
              )}

              {updatedAt && (
                <p className="text-sm text-muted-foreground">
                  {formatDistanceToNow(fromUnixTime(updatedAt), {
                    addSuffix: true,
                  })}
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-x-1 text-muted-foreground items-center">
            <Link href={`/to/${username}`} className="hover:underline">
              <Icons.chat className="h-5 w-5" />
            </Link>

            {menuItems && <Menu menuItems={menuItems} />}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex w-full gap-3">
        <p className="whitespace-pre-wrap break-words min-w-0">{note}</p>
      </CardContent>
    </Card>
  );
}
