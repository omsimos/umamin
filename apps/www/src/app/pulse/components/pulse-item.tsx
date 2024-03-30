"use client";

import React from "react";
import Link from "next/link";
import { ScanFace } from "lucide-react";
import { Avatar, AvatarFallback } from "@umamin/ui/components/avatar";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@umamin/ui/components/tooltip";
import { PulseDropDownMenu } from "./dropdown-menu";
import { SendMessageDrawer } from "./send-message-drawer";

export default function PulseItem() {
  return (
    <div className='flex items-start justify-between border-b py-10 text-[#f2f4f6] last:border-0'>
      <div className='flex w-full items-start gap-3'>
        <Link href={`/user/johndoe`} className='font-semibold'>
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

        <div className='w-full space-y-1'>
          <div className='flex justify-between'>
            <Link
              href={`/user/$johndoe`}
              className='font-semibold hover:underline'
            >
              {/* {post.author.name} */}
              johndoe
            </Link>

            {/* 
             DropDownMenu
            */}

            <div className='flex gap-1 text-muted-foreground items-center'>
              <SendMessageDrawer />
              <PulseDropDownMenu />
            </div>
          </div>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger className='text-sm text-muted-foreground'>
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

          <p className='whitespace-pre-wrap'>
            Lorem ipsum dolor sit amet consectetur adipisicing elit. Corrupti
            omnis quam dicta provident reiciendis itaque eum veniam non dolorum
            aperiam?
          </p>
        </div>
      </div>
    </div>
  );
}
