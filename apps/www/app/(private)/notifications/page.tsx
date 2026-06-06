import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getQueryClient } from "@/lib/get-query-client";
import { queryKeys } from "@/lib/query";
import type { NotificationsResponse } from "@/lib/query-types";
import { getNotificationsPage } from "@/lib/server/data";
import { NotificationsList } from "./components/notifications-list";

export const metadata: Metadata = {
  title: "Umamin — Notifications",
  description: "Catch up on likes, comments, follows, and new messages.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function NotificationsPage() {
  const { session } = await getSession();

  if (!session) {
    redirect("/login");
  }

  const queryClient = getQueryClient();

  await queryClient.prefetchInfiniteQuery({
    queryKey: queryKeys.notifications(),
    queryFn: ({ pageParam }) =>
      getNotificationsPage({
        viewerId: session.userId,
        cursor: (pageParam as string | null) ?? null,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: NotificationsResponse) =>
      lastPage.nextCursor ?? null,
    staleTime: 30_000,
  });

  return (
    <main className="max-w-xl mx-auto min-h-screen container">
      <h1 className="text-lg font-semibold">Notifications</h1>

      <HydrationBoundary state={dehydrate(queryClient)}>
        <div className="mt-5">
          <NotificationsList />
        </div>
      </HydrationBoundary>
    </main>
  );
}
