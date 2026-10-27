import { CircleUserRoundIcon } from "lucide-react";
import { useDmUnread } from "@/hooks/use-dm-unread";
import { MenubarLink } from "./menubar-link";

// The bottom-nav Profile slot. Chats live under the profile's inbox tabs, so
// their unread dot shows here.
export function NavProfile({ username }: { username: string }) {
  const unread = useDmUnread();
  return (
    <MenubarLink
      href={`/user/${username}`}
      ariaLabel={unread > 0 ? "Your profile (unread chats)" : "Your profile"}
      title="Profile"
    >
      <span className="relative">
        <CircleUserRoundIcon className="h-6 w-6" />
        {unread > 0 && (
          <span
            aria-hidden
            className="absolute -right-1 -top-1 size-2.5 rounded-full bg-primary ring-2 ring-background"
          />
        )}
      </span>
    </MenubarLink>
  );
}
