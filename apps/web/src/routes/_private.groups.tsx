import { createFileRoute } from "@tanstack/react-router";
import { loaderFetchJson } from "@/lib/loader-fetch";
import { queryKeys } from "@/lib/query";
import type { UserGroupsResponse } from "@/lib/types";
import { GroupsHub } from "./-groups/groups-hub";
import { BackHeaderPage } from "./-shared/chrome";

export const Route = createFileRoute("/_private/groups")({
  // SSR-prime the hub list (parity with www's HydrationBoundary prefetch).
  // groupUnread is deliberately not primed — it's gated on GROUP_CHAT_ENABLED
  // and polled client-side.
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({
      queryKey: queryKeys.userGroups(),
      queryFn: () => loaderFetchJson<UserGroupsResponse>("/api/groups"),
    });
  },
  head: () => ({ meta: [{ title: "Umamin — Groups" }] }),
  component: GroupsPage,
});

function GroupsPage() {
  return (
    <BackHeaderPage>
      <div className="mx-auto min-h-screen w-full max-w-lg container pb-24">
        <GroupsHub />
      </div>
    </BackHeaderPage>
  );
}
