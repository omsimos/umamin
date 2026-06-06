import { LinkTabs } from "@/components/link-tabs";

type YouTabsProps = {
  username: string;
  active: "posts" | "received" | "sent";
};

// Route-switching tabs: Posts -> public profile, Received/Sent -> private
// inbox — keeps posts cached/public and messages private/auth-gated as one
// flat tab row (no nested tab levels).
export function YouTabs({ username, active }: YouTabsProps) {
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
      ]}
    />
  );
}
