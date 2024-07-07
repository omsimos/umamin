import React from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@umamin/ui/components/dropdown-menu";

import { Icons } from "@/app/components/utilities/icons";

export type MenuItems = {
  title: string;
  onClick: () => void;
  className?: string;
}[];

export const Menu = ({ menuItems }: { menuItems: MenuItems }) => {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger title="post menu">
        <Icons.elipsisVertical />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="font-semibold [&>*]:cursor-pointer [&>*]:border-b [&>*]:last:border-0">
        {menuItems.map((item, i) => (
          <React.Fragment key={item.title}>
            <DropdownMenuItem onClick={item.onClick} className={item.className}>
              {item.title}
            </DropdownMenuItem>
            {i + 1 !== menuItems.length && <DropdownMenuSeparator />}
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
