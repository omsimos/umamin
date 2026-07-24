import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Skeleton } from "@umamin/ui/components/skeleton";
import { ClientOnlyAdContainer } from "@/components/ad-container-client";
import { UserCardSkeleton } from "@/components/skeleton/user-card-skeleton";
import { YouTabs } from "@/components/you-tabs";
import { PRIVATE_STALE_TIME, queryKeys } from "@/lib/query";
import { fetchCurrentUserOptional } from "@/lib/query-fetchers";
import { CurrentUserCard } from "./-inbox/current-user-card";
import { ReceivedMessageCardSkeleton } from "./-inbox/received-message-card-skeleton";
import { ReceivedMessages } from "./-inbox/received-messages";
import { SentMessages } from "./-inbox/sent-messages";
import { BackHeaderPage } from "./-shared/chrome";

type InboxSearch = { tab?: "received" | "sent" };

export const Route = createFileRoute("/_private/inbox")({
  validateSearch: (search: Record<string, unknown>): InboxSearch => ({
    tab: search.tab === "sent" ? "sent" : undefined,
  }),
  head: () => ({ meta: [{ title: "Umamin — Inbox" }] }),
  pendingComponent: InboxPending,
  component: InboxPage,
});

function InboxPage() {
  const { tab } = Route.useSearch();
  const active = tab === "sent" ? "sent" : "received";

  const { data } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: fetchCurrentUserOptional,
    staleTime: PRIVATE_STALE_TIME,
  });
  const username = data?.user?.username;

  return (
    <BackHeaderPage>
      <main className="max-w-xl mx-auto min-h-screen container">
        <CurrentUserCard />

        {username ? <YouTabs username={username} active={active} /> : null}

        <ClientOnlyAdContainer className="mt-5" placement="inbox_top" />

        <div className="mt-5">
          {active === "sent" ? <SentMessages /> : <ReceivedMessages />}
        </div>

        <ClientOnlyAdContainer className="mt-5" placement="profile_bottom" />
      </main>
    </BackHeaderPage>
  );
}

function InboxPending() {
  return (
    <BackHeaderPage>
      <main className="max-w-xl mx-auto min-h-screen container">
        <UserCardSkeleton />

        <div className="mt-4 space-y-4">
          <div className="flex gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>

          <ReceivedMessageCardSkeleton />
          <ReceivedMessageCardSkeleton />
        </div>
      </main>
    </BackHeaderPage>
  );
}
