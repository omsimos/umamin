import { UserCard } from "@/components/user-card";
import type { MusicAttachment } from "@/lib/music";
import { getGroupBadge } from "@/lib/server/data";
import type { PublicUser } from "@/types/user";

export async function CurrentUserCard({
  user,
  bannerImageUrl,
  music,
}: {
  user: PublicUser | null;
  // Passed separately since PublicUser drops bannerImageUrl + music (both
  // profile-header-only — resolved by the caller from the full user row).
  bannerImageUrl?: string | null;
  music?: MusicAttachment | null;
}) {
  if (!user) {
    return null;
  }

  const groupBadge = user.equippedGroupId
    ? await getGroupBadge(user.equippedGroupId)
    : null;

  // The inbox header is the viewer's own profile (same header the Posts tab
  // shows), so it gets the edit pencil too.
  return (
    <UserCard user={{ ...user, groupBadge, bannerImageUrl, music }} isSelf />
  );
}
