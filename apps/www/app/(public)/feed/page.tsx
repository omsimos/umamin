import { HydrationBoundary } from "@tanstack/react-query";
import { redirect } from "next/navigation";
import { getDehydratedPublicFeed } from "@/lib/server-fetchers";
import { FeedContent } from "./components/feed-content";

export default async function Feed() {
  if (process.env.NEXT_PUBLIC_SOCIAL_UNDER_MAINTENANCE === "true") {
    redirect("/social");
  }

  // The prefetch is wrapped in `use cache` with a 5-minute revalidate, so this
  // page stays prerendered and only hits Hono on cache revalidation.
  let dehydratedState = null;
  try {
    dehydratedState = await getDehydratedPublicFeed();
  } catch {
    // Fall through to client-side fetch on the rare Hono outage.
  }

  return (
    <main className="pb-40">
      <section className="pt-6 w-full max-w-xl mx-auto bg-background border-muted">
        <HydrationBoundary state={dehydratedState}>
          <FeedContent />
        </HydrationBoundary>
      </section>
    </main>
  );
}
