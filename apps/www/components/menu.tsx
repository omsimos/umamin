import React from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icons } from "@/lib/icons";

export type MenuItems = {
  title: string;
  onClick: () => void;
  className?: string;
}[];

export const Menu = ({ menuItems }: { menuItems: MenuItems }) => {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger>
        <Icons.elipsisVertical />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
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
