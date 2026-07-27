import { useQuery } from "@tanstack/react-query";
import { UserCard } from "@/components/user-card";
import { PRIVATE_STALE_TIME, queryKeys } from "@/lib/query";
import { fetchCurrentUserOptional } from "@/lib/query-fetchers";

// The inbox header is the viewer's own profile card (same header the Posts tab
// shows). apps/www resolved the group badge server-side; the /api/me payload
// (CurrentUserData) already carries groupBadge + bannerImageUrl + music, so we
// render straight from the current-user query.
export function CurrentUserCard() {
  const { data } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: fetchCurrentUserOptional,
    staleTime: PRIVATE_STALE_TIME,
  });

  const user = data?.user ?? null;
  if (!user) {
    return null;
  }

  return <UserCard user={user} isSelf />;
}
