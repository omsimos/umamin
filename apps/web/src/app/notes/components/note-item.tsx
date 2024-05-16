"use client"

import Link from "next/link";
import { toast } from "sonner";

import { Menu } from "@/app/components/menu";
import { SendMessageDrawer } from "./send-message-drawer";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@umamin/ui/components/avatar";
import { Card, CardContent, CardHeader } from "@umamin/ui/components/card";

type Props = {
  username: string;
  imageUrl: string;
  note: string;
};

export function NoteItem({ username, imageUrl, note }: Props) {
  const menuItems = [
    {
      title: "View",
      onClick: () => {
        toast.error("Not implemented yet");
      },
    },
    {
      title: "Message",
      onClick: () => {
        toast.error("Not implemented yet");
      },
    },
    {
      title: "Report",
      onClick: () => {
        toast.error("Not implemented yet");
      },
      className: "text-red-500",
    },
  ];

  return (
    <Card className="flex flex-col items-start justify-between">
      <CardHeader className="w-full">
        <div className="flex justify-between">
          <div className="flex gap-4">
            <Link href={`/user/johndoe`} className="font-semibold">
              <Avatar className="relative top-1">
                <AvatarImage
                  className="rounded-full"
                  src={imageUrl}
                  alt="User avatar"
                />
                <AvatarFallback className="text-xs">
                  {username[0]}
                </AvatarFallback>
              </Avatar>
            </Link>

            <div className="flex flex-col">
              <Link
                href={`/user/${username}`}
                className="font-semibold hover:underline"
              >
                {username}
              </Link>

              <p className="text-sm text-muted-foreground">umamin.link</p>
            </div>
          </div>

          <div className="flex gap-1 text-muted-foreground items-center">
            <SendMessageDrawer />
            <Menu menuItems={menuItems} />
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex w-full gap-3">
        <p className="whitespace-pre-wrap">{note}</p>
      </CardContent>
    </Card>
  );
}
