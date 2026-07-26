import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Skeleton } from "@umamin/ui/components/skeleton";
import { ClientOnlyAdContainer } from "@/components/ad-container-client";
import { UserCardSkeleton } from "@/components/skeleton/user-card-skeleton";
import { YouTabs } from "@/components/you-tabs";
import { loaderFetchJson } from "@/lib/loader-fetch";
import { PRIVATE_STALE_TIME, queryKeys } from "@/lib/query";
import { fetchCurrentUserOptional } from "@/lib/query-fetchers";
import { pageSeo } from "@/lib/seo";
import type { MessagesResponse } from "@/lib/types";
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
  loaderDeps: ({ search }) => ({ tab: search.tab }),
  // SSR-prime the active tab's first page (parity with www's HydrationBoundary
  // prefetch) so the list hydrates without a skeleton flash + client refetch.
  loader: async ({ context, deps }) => {
    const type = deps.tab === "sent" ? "sent" : "received";
    await context.queryClient.ensureInfiniteQueryData({
      queryKey:
        type === "sent"
          ? queryKeys.sentMessages()
          : queryKeys.receivedMessages(),
      queryFn: () =>
        loaderFetchJson<MessagesResponse>(`/api/messages?type=${type}`),
      initialPageParam: null as string | null,
    });
  },
  head: () =>
    pageSeo({
      title: "Umamin — Inbox",
      description:
        "Read the encrypted anonymous messages sent to you on Umamin.",
      robots: "noindex, nofollow",
    }),
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
