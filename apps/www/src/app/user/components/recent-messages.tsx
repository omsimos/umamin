"use client";

import React, { useState } from "react";
import { toast } from "sonner";
// import { formatDistanceToNow } from "date-fns";
// import { ProfileDropdownMenu } from "./profile-dropdown-menu";

import { Menu } from "@/app/components/menu";
import { MenuItems } from "@/app/components/menu";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@umamin/ui/components/card";

import { Dialog, DialogContent } from "@umamin/ui/components/dialog";

type Message = {
  message: string;
  reply: string;
};

export function RecentMessages() {
  const [openMsgCard, setOpenMsgCard] = useState(false);

  const msgList: Message[] = [
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

  {
    /**
Insert in component to handle fn via ID
*/
  }
  const menuItems: MenuItems = [
    {
      title: "View",
      onClick: () => {
        setOpenMsgCard(!openMsgCard);
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
      <Dialog onOpenChange={setOpenMsgCard} open={openMsgCard}>
        <DialogContent className='p-10'>
          <ReceivedMessageCard
            msg={msgList[0]}
            menuItems={menuItems}
            openMsgCard={openMsgCard}
          />
        </DialogContent>
      </Dialog>

      {msgList.map((msg) => (
        <ReceivedMessageCard key={msg.reply} msg={msg} menuItems={menuItems} />
      ))}
    </div>
  );
}

const ReceivedMessageCard = ({
  msg,
  menuItems,
  openMsgCard,
}: {
  msg: Message;
  menuItems: MenuItems;
  openMsgCard?: boolean;
}) => {
  return (
    <div className='w-full min-w-2'>
      <Card className='w-full group relative'>
        <div
          className={`absolute group-hover:opacity-100 opacity-0 transition-opacity top-4 right-4 text-muted-foreground ${openMsgCard ? "hidden" : ""}`}
        >
          <Menu menuItems={menuItems} />
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
  );
};
