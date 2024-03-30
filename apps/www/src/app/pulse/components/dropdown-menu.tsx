import React from "react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@umamin/ui/components/dropdown-menu";

import { Icons } from "@/app/components/utilities/icons";

export const PulseDropDownMenu = () => {
  const menu = [
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
    <DropdownMenu>
      <DropdownMenuTrigger title='post menu'>
        <Icons.elipsisVertical />
      </DropdownMenuTrigger>
      <DropdownMenuContent className='font-semibold [&>*]:cursor-pointer [&>*]:border-b [&>*]:last:border-0'>
        {menu.map((item, i) => (
          <React.Fragment key={item.title}>
            <DropdownMenuItem onClick={item.onClick} className={item.className}>
              {item.title}
            </DropdownMenuItem>
            {i + 1 !== menu.length && <DropdownMenuSeparator />}
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
