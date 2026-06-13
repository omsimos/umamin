import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ClientOnlyAdContainer } from "@/components/ad-container-client";
import { UserCardSkeleton } from "@/components/skeleton/user-card-skeleton";
import { YouTabs } from "@/components/you-tabs";
import { getSession } from "@/lib/auth";
import { getQueryClient } from "@/lib/get-query-client";
import { queryKeys } from "@/lib/query";
import type { MessagesResponse } from "@/lib/query-types";
import { getMessagesPage } from "@/lib/server/data";
import { toPublicUser } from "@/types/user";
import { CurrentUserCard } from "./components/current-user-card";
import { ReceivedMessages } from "./components/received/received-messages";
import { SentMessages } from "./components/sent/sent-messages";

export const metadata: Metadata = {
  title: "Umamin — Inbox",
  description:
    "Manage your received messages securely on Umamin. View, reply, and organize your inbox.",
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    type: "website",
    title: "Umamin — Inbox",
    description:
      "Manage your received messages securely on Umamin. View, reply, and organize your inbox.",
    url: "https://www.umamin.link/inbox",
  },
  twitter: {
    card: "summary_large_image",
    title: "Umamin — Inbox",
    description:
      "Manage your received messages securely on Umamin. View, reply, and organize your inbox.",
  },
};

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { session, user } = await getSession();

  if (!session) {
    redirect("/login");
  }

  // Received and Sent are flat top-level tabs (one row with Posts), routed by
  // search param so each direction stays linkable and back-button friendly.
  const tab = (await searchParams).tab === "sent" ? "sent" : "received";

  const queryClient = getQueryClient();

  await queryClient.prefetchInfiniteQuery({
    queryKey:
      tab === "sent" ? queryKeys.sentMessages() : queryKeys.receivedMessages(),
    queryFn: ({ pageParam }) =>
      getMessagesPage({
        type: tab,
        cursor: (pageParam as string | null) ?? null,
        userId: session.userId,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: MessagesResponse) =>
      lastPage.nextCursor ?? null,
    staleTime: 30_000,
  });

  return (
    <main className="max-w-xl mx-auto min-h-screen container">
      <Suspense fallback={<UserCardSkeleton />}>
        <CurrentUserCard
          user={user ? toPublicUser(user) : null}
          bannerImageUrl={user?.bannerImageUrl}
        />
      </Suspense>

      {user?.username ? (
        <YouTabs username={user.username} active={tab} />
      ) : null}

      <ClientOnlyAdContainer className="mt-5" placement="inbox_top" />

      <HydrationBoundary state={dehydrate(queryClient)}>
        <div className="mt-5">
          {tab === "sent" ? <SentMessages /> : <ReceivedMessages />}
        </div>
      </HydrationBoundary>

      {/* v2-user */}
      <ClientOnlyAdContainer className="mt-5" placement="profile_bottom" />
    </main>
  );
}
