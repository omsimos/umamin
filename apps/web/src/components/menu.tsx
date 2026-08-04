import { Button } from "@umamin/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@umamin/ui/components/dropdown-menu";
import { EllipsisVerticalIcon } from "lucide-react";
import React from "react";

export type MenuItems = {
  title: string;
  onClick: () => void;
  icon?: React.ReactNode;
  className?: string;
  disabled?: boolean;
}[];

export const Menu = ({ menuItems }: { menuItems: MenuItems }) => {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        {/* 32px tap target inside a 24px layout box so card rows keep their
            height. */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="More options"
          className="size-8 -m-1"
        >
          <EllipsisVerticalIcon className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {menuItems.map((item, i) => (
          <React.Fragment key={item.title}>
            <DropdownMenuItem
              disabled={item.disabled}
              onClick={item.onClick}
              className={item.className}
            >
              <span className="flex items-center gap-2">
                {item.icon}
                {item.title}
              </span>
            </DropdownMenuItem>
            {i + 1 !== menuItems.length && <DropdownMenuSeparator />}
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
