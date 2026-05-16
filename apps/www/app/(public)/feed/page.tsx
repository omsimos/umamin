import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { redirect } from "next/navigation";
import { getQueryClient } from "@/lib/get-query-client";
import { queryKeys } from "@/lib/query";
import { fetchPublicPostsPageServer } from "@/lib/server-fetchers";
import { FeedContent } from "./components/feed-content";

// ISR: regenerate the static HTML + dehydrated cache at most once per minute.
// Keeps Vercel function invocations at zero for the steady-state cached path.
export const revalidate = 60;

export default async function Feed() {
  if (process.env.NEXT_PUBLIC_SOCIAL_UNDER_MAINTENANCE === "true") {
    redirect("/social");
  }

  const queryClient = getQueryClient();

  try {
    const firstPage = await fetchPublicPostsPageServer(60);
    queryClient.setQueryData(queryKeys.posts("public"), {
      pages: [firstPage],
      pageParams: [null],
    });
  } catch {
    // Fall through to client-side fetch on the rare Hono outage during ISR.
  }

  return (
    <main className="pb-40">
      <section className="pt-6 w-full max-w-xl mx-auto bg-background border-muted">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <FeedContent />
        </HydrationBoundary>
      </section>
    </main>
  );
}
