import { UserCard } from "@/components/user-card";
import { getGroupBadge } from "@/lib/server/data";
import type { PublicUser } from "@/types/user";

export async function CurrentUserCard({ user }: { user: PublicUser | null }) {
  if (!user) {
    return null;
  }

  const groupBadge = user.equippedGroupId
    ? await getGroupBadge(user.equippedGroupId)
    : null;

  return <UserCard user={{ ...user, groupBadge }} />;
}
