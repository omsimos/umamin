"use client";

import React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ScanFace } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@umamin/ui/components/tooltip";

import { SendMessageDrawer } from "./send-message-drawer";
import { Menu } from "@/app/components/menu";
import { Avatar, AvatarFallback } from "@umamin/ui/components/avatar";
import { Card, CardContent, CardHeader } from "@umamin/ui/components/card";

export function NoteItem() {
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
              {/* <Avatar className="relative top-1">
            <AvatarImage
            className="rounded-full"
            src={post.author.image as string | undefined}
            alt={`${post.author.name}'s avatar`}
            />
            <AvatarFallback className="text-xs">
            {post.author.name?.split(" ").at(0)}
            </AvatarFallback>
          </Avatar> */}
              <Avatar>
                <AvatarFallback>
                  <ScanFace />
                </AvatarFallback>
              </Avatar>
            </Link>

            <div className="flex flex-col">
              <Link
                href={`/user/$johndoe`}
                className="font-semibold hover:underline"
              >
                {/* {post.author.name} */}
                johndoe
              </Link>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger className="text-sm text-muted-foreground">
                    {/* <span className="select-none text-muted-foreground">
                      {formatDistanceToNowStrict(post.createdAt, {
                        addSuffix: false,
                        locale: {
                          formatDistance: (...props) =>
                          formatDistance(...props),
                        },
                      })}
                    </span> */}
                    4h · umamin.link
                  </TooltipTrigger>
                  <TooltipContent>
                    {/* <span>{formatRelative(post.createdAt, new Date())}</span> */}
                    full date
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          <div className="flex gap-1 text-muted-foreground items-center">
            <SendMessageDrawer />
            <Menu menuItems={menuItems} />
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex w-full gap-3">
        <p className="whitespace-pre-wrap">
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Corrupti sd
          omnis quam dicta provident reiciendis itaque eum veniam non dolorum
          aperiam?
        </p>
      </CardContent>
    </Card>
  );
}
