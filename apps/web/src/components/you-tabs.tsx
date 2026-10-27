import { LinkTabs } from "@/components/link-tabs";
import { useDmUnread } from "@/hooks/use-dm-unread";
import { useFeatureFlags } from "@/hooks/use-feature-flags";

type YouTabsProps = {
  username: string;
  active: "posts" | "received" | "sent" | "chats";
};

// Route-switching tabs: Posts -> public profile, Received/Sent/Chats ->
// private inbox. Keeps posts cached/public and messages private/auth-gated as
// one flat tab row (no nested tab levels).
export function YouTabs({ username, active }: YouTabsProps) {
  const { dm } = useFeatureFlags();
  const unread = useDmUnread();
  return (
    <LinkTabs
      className="mt-6"
      tabs={[
        {
          label: "Posts",
          href: `/user/${username}`,
          active: active === "posts",
        },
        { label: "Received", href: "/inbox", active: active === "received" },
        { label: "Sent", href: "/inbox?tab=sent", active: active === "sent" },
        ...(dm
          ? [
              {
                label: "Chats",
                href: "/inbox?tab=chats",
                active: active === "chats",
                badge: unread,
              },
            ]
          : []),
      ]}
    />
  );
}
