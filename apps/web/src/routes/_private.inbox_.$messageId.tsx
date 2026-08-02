import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { loaderFetchOptional } from "@/lib/loader-fetch";
import { queryKeys } from "@/lib/query";
import { fetchMessageThread } from "@/lib/query-fetchers";
import { pageSeo } from "@/lib/seo";
import type { MessageThreadResponse } from "@/lib/types";
import { MessageThreadView, ThreadViewSkeleton } from "./-inbox/thread-view";
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
  // Loader-primed; a plain cache read avoids re-declaring the query config.
  const thread = useQueryClient().getQueryData<MessageThreadResponse>(
    queryKeys.messageThread(messageId),
  );
  const backHref =
    thread?.viewerRole === "sender" ? "/inbox?tab=sent" : "/inbox";

  return (
    <BackHeaderPage backHref={backHref} backLabel="Back to inbox">
      {/* pt: BackHeaderPage lands content exactly on the fixed header's edge.
          pb: clears the mobile Menubar, which is fixed over the page bottom. */}
      <main className="container mx-auto min-h-screen max-w-xl pt-6 pb-28 lg:pb-12">
        <MessageThreadView messageId={messageId} />
      </main>
    </BackHeaderPage>
  );
}

function ThreadPending() {
  return (
    <BackHeaderPage backHref="/inbox" backLabel="Back to inbox">
      <main className="container mx-auto min-h-screen max-w-xl pt-6 pb-28 lg:pb-12">
        <ThreadViewSkeleton />
      </main>
    </BackHeaderPage>
  );
}
