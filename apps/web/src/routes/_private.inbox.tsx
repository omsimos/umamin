import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Skeleton } from "@umamin/ui/components/skeleton";
import { ClientOnlyAdContainer } from "@/components/ad-container-client";
import { UserCardSkeleton } from "@/components/skeleton/user-card-skeleton";
import { YouTabs } from "@/components/you-tabs";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import type { DmThreadsResponse } from "@/lib/dm/types";
import { loaderFetchJson } from "@/lib/loader-fetch";
import { loadFeatureFlags } from "@/lib/loader-flags";
import { PRIVATE_STALE_TIME, queryKeys } from "@/lib/query";
import { fetchCurrentUserOptional } from "@/lib/query-fetchers";
import { pageSeo } from "@/lib/seo";
import type { MessagesResponse } from "@/lib/types";
import { ChatsList } from "./-dm/chats-list";
import { CurrentUserCard } from "./-inbox/current-user-card";
import { ReceivedMessageCardSkeleton } from "./-inbox/received-message-card-skeleton";
import { ReceivedMessages } from "./-inbox/received-messages";
import { SentMessages } from "./-inbox/sent-messages";
import { BackHeaderPage } from "./-shared/chrome";

type InboxSearch = { tab?: "received" | "sent" | "chats" };

export const Route = createFileRoute("/_private/inbox")({
  validateSearch: (search: Record<string, unknown>): InboxSearch => ({
    tab:
      search.tab === "sent" || search.tab === "chats" ? search.tab : undefined,
  }),
  loaderDeps: ({ search }) => ({ tab: search.tab }),
  // SSR-prime the active tab's first page (parity with www's HydrationBoundary
  // prefetch) so the list hydrates without a skeleton flash + client refetch.
  loader: async ({ context, deps }) => {
    if (deps.tab === "chats") {
      const flags = await loadFeatureFlags(context.queryClient);
      if (flags.dm) {
        await context.queryClient.ensureInfiniteQueryData({
          queryKey: queryKeys.dmThreads(),
          queryFn: () => loaderFetchJson<DmThreadsResponse>("/api/dm/threads"),
          initialPageParam: null as string | null,
        });
        return;
      }
    }
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
      title: "Inbox | Umamin",
      description:
        "Read the encrypted anonymous messages sent to you on Umamin.",
      robots: "noindex, nofollow",
    }),
  pendingComponent: InboxPending,
  component: InboxPage,
});

function InboxPage() {
  const { tab } = Route.useSearch();
  const flags = useFeatureFlags();
  const active =
    tab === "chats" && flags.dm
      ? "chats"
      : tab === "sent"
        ? "sent"
        : "received";

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
          {active === "chats" ? (
            <ChatsList />
          ) : active === "sent" ? (
            <SentMessages />
          ) : (
            <ReceivedMessages />
          )}
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
