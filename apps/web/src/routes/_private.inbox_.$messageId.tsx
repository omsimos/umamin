import { createFileRoute, notFound } from "@tanstack/react-router";
import { Skeleton } from "@umamin/ui/components/skeleton";
import { loaderFetchOptional } from "@/lib/loader-fetch";
import { queryKeys } from "@/lib/query";
import { fetchMessageThread } from "@/lib/query-fetchers";
import { pageSeo } from "@/lib/seo";
import type { MessageThreadResponse } from "@/lib/types";
import { MessageThreadView } from "./-inbox/thread-view";
import { BackHeaderPage } from "./-shared/chrome";

// `inbox_` (escape underscore) keeps this OUT of the /inbox route's component
// tree — the thread is its own page, not a tab of the list.
export const Route = createFileRoute("/_private/inbox_/$messageId")({
  loader: async ({ context, params }) => {
    const thread = await context.queryClient.ensureQueryData({
      queryKey: queryKeys.messageThread(params.messageId),
      queryFn: () =>
        loaderFetchOptional<MessageThreadResponse | null>(
          `/api/messages/${params.messageId}/thread`,
          () => fetchMessageThread(params.messageId),
          null,
        ),
    });

    // Non-participant / blocked / deleted all 404 — same as the API.
    if (!thread) {
      throw notFound();
    }
  },
  head: () =>
    pageSeo({
      title: "Umamin — Conversation",
      description: "Continue an anonymous conversation on Umamin.",
      robots: "noindex, nofollow",
    }),
  pendingComponent: ThreadPending,
  component: ThreadPage,
});

function ThreadPage() {
  const { messageId } = Route.useParams();

  return (
    <BackHeaderPage>
      <main className="max-w-xl mx-auto min-h-screen container">
        <MessageThreadView messageId={messageId} />
      </main>
    </BackHeaderPage>
  );
}

function ThreadPending() {
  return (
    <BackHeaderPage>
      <main className="max-w-xl mx-auto min-h-screen container">
        <Skeleton className="mx-auto h-6 w-2/3" />
        <div className="mt-10 space-y-4">
          <Skeleton className="h-14 w-3/4" />
          <Skeleton className="ml-auto h-14 w-3/4" />
          <Skeleton className="h-14 w-2/3" />
        </div>
      </main>
    </BackHeaderPage>
  );
}
