import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { UserCardSkeleton } from "@/components/skeleton/user-card-skeleton";
import { getSession } from "@/lib/auth";
import { getQueryClient } from "@/lib/get-query-client";
import { queryKeys } from "@/lib/query";
import type { MessagesResponse } from "@/lib/query-types";
import { getMessagesPage } from "@/lib/server/data";
import { toPublicUser } from "@/types/user";
import { CurrentUserCard } from "./components/current-user-card";
import { InboxTabs } from "./components/inbox-tabs";

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

export default async function InboxPage() {
  const { session, user } = await getSession();

  if (!session) {
    redirect("/login");
  }

  const queryClient = getQueryClient();

  await queryClient.prefetchInfiniteQuery({
    queryKey: queryKeys.receivedMessages(),
    queryFn: ({ pageParam }) =>
      getMessagesPage({
        type: "received",
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
        <CurrentUserCard user={user ? toPublicUser(user) : null} />
      </Suspense>

      <HydrationBoundary state={dehydrate(queryClient)}>
        <InboxTabs />
      </HydrationBoundary>
    </main>
  );
}
