import { LinkTabs } from "@/components/link-tabs";

type YouTabsProps = {
  username: string;
  active: "posts" | "messages";
};

// Route-switching tabs: Posts -> public profile, Messages -> private inbox —
// keeps posts cached/public and messages private/auth-gated as one surface.
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
        { label: "Messages", href: "/inbox", active: active === "messages" },
      ]}
    />
  );
}
