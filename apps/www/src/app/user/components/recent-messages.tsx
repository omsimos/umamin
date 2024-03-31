"use client";

import React from "react";
import { toast } from "sonner";
// import { formatDistanceToNow } from "date-fns";
// import { ProfileDropdownMenu } from "./profile-dropdown-menu";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@umamin/ui/components/tooltip";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@umamin/ui/components/dropdown-menu";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@umamin/ui/components/card";
import { Icons } from "../../components/utilities/icons";
import { ChatList } from "@/app/components/chat-list";

export function RecentMessages() {
  const msgList = [
    {
      message: "Send me an anonymous message!",
      reply:
        "Thinking of hitting the hiking trails if the weather holds up. Need some fresh air after being cooped up indoors. Although, I'm not ready to face the cold yet. 😅",
    },
    {
      message: "Send me an anonymous message!",
      reply:
        "Have you every wondered what it would be like to live in a different country? I've been thinking about it a lot lately.",
    },
  ];

  const menu = [
    {
      title: "View",
      onClick: () => {
        toast.error("Not implemented yet");
      },
    },
    {
      title: "Download",
      onClick: () => {
        toast.error("Not implemented yet");
      },
    },
    {
      title: "Delete",
      onClick: () => {
        toast.error("Not implemented yet");
      },
      className: "text-red-500",
    },
  ];

  return (
    <div className='flex flex-col items-center gap-5 pb-20'>
      {msgList.map((msg) => (
        <div className='w-full'>
          <Card className='w-full group relative'>
            <div className='absolute top-4 right-4'>
              <DropdownMenu>
                <DropdownMenuTrigger
                  title='post menu'
                  className='opacity-0 outline-none text-muted-foreground group-hover:opacity-100 transition-opacity focus:opacity-100'
                >
                  <Icons.elipsis />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align='start'
                  className='font-semibold [&>*]:cursor-pointer [&>*]:border-b [&>*]:last:border-0'
                >
                  {menu.map((item, i) => (
                    <React.Fragment key={item.title}>
                      <DropdownMenuItem
                        onClick={item.onClick}
                        className={item.className}
                      >
                        {item.title}
                      </DropdownMenuItem>
                      {i + 1 !== menu.length && <DropdownMenuSeparator />}
                    </React.Fragment>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <CardHeader className='flex'>
              <p className='font-bold text-center  text-lg'>{msg.message}</p>
            </CardHeader>
            <CardContent>
              <div className='flex w-max max-w-full flex-col gap-2 rounded-lg p-5 whitespace-pre-wrap bg-muted'>
                {msg.reply}
              </div>
            </CardContent>
            <CardFooter className='flex justify-center'>
              <p className='text-muted-foreground text-sm mt-1 italic'>
                4h · umamin
              </p>
            </CardFooter>
          </Card>
        </div>
      ))}
    </div>
  );
}
