import { UserCard } from "@/components/user-card";
import { getGroupBadge } from "@/lib/server/data";
import type { PublicUser } from "@/types/user";

export async function CurrentUserCard({
  user,
  bannerImageUrl,
}: {
  user: PublicUser | null;
  // Passed separately since PublicUser drops bannerImageUrl (profile-only field).
  bannerImageUrl?: string | null;
}) {
  if (!user) {
    return null;
  }

  const groupBadge = user.equippedGroupId
    ? await getGroupBadge(user.equippedGroupId)
    : null;

  return <UserCard user={{ ...user, groupBadge, bannerImageUrl }} />;
}
