import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSession } from "@/lib/auth";
import { getQueryClient } from "@/lib/get-query-client";
import { queryKeys } from "@/lib/query";
import { getCurrentUserData, getUserGroups } from "@/lib/server/data";
import { GroupsHub } from "./groups-hub";

export const metadata: Metadata = {
  title: "Umamin — Groups",
  description: "Create and manage your groups on Umamin.",
  robots: { index: false, follow: false },
};

export default function GroupsPage() {
  return (
    <div className="mx-auto min-h-screen w-full max-w-lg container pb-24">
      <Suspense fallback={null}>
        <GroupsContent />
      </Suspense>
    </div>
  );
}

// Session-dependent work lives inside Suspense so the cookie read doesn't
// block the static page shell (cacheComponents requires this).
async function GroupsContent() {
  const { session } = await getSession();

  if (!session) {
    redirect("/login");
  }

  const queryClient = getQueryClient();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.currentUser(),
      queryFn: () => getCurrentUserData(session.userId),
      staleTime: 30_000,
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.userGroups(),
      queryFn: () => getUserGroups(session.userId),
      staleTime: 30_000,
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <GroupsHub />
    </HydrationBoundary>
  );
}
