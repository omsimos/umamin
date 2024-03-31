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

export function SentMessages() {
  const _messages = [
    {
      role: "recipient",
      content:
        "The quick brown fox jumps over the lazy dog near the bank of the river?",
    },
    {
      role: "user",
      content: "Near the bank of the river, the fox really did it!!",
    },
    // {
    //   role: "user",
    //   content: "I'm just speechless",
    // },
  ];

  const messageList = [_messages, _messages];

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
    <div className='flex w-full flex-col items-center gap-5 pb-20'>
      {messageList.map((message) => (
        <Card className='w-full'>
          <CardHeader>
            <div className='flex justify-between items-center text-muted-foreground'>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type='button' className='h-4 w-4'>
                      <Icons.info />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>I'm the quick brown 🦊</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <span className='font-semibold'>umamin</span>
              <DropdownMenu>
                <DropdownMenuTrigger title='post menu' className='outline-none'>
                  <Icons.elipsis />
                </DropdownMenuTrigger>
                <DropdownMenuContent className='font-semibold [&>*]:cursor-pointer [&>*]:border-b [&>*]:last:border-0'>
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
          </CardHeader>
          <CardContent className='p-0'>
            <ChatList messages={message} />
          </CardContent>
          <CardFooter className='flex justify-center'>
            {/* <p className='text-muted-foreground text-sm mt-1'>
              Joined{" "}
              {formatDistanceToNow(new Date(_user?.createdAt), {
                addSuffix: true,
              })}
            </p> */}
            <p className='text-muted-foreground text-sm mt-1 italic'>
              3 hours ago
            </p>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
