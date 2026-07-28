import { createFileRoute } from "@tanstack/react-router";
import { Skeleton } from "@umamin/ui/components/skeleton";
import { AppHeader } from "@/components/app-header";
import { ChatAnnouncement } from "@/components/chat-announcement";
import { RouteSegmentError } from "@/components/route-segment-error";
import { loadViewerId } from "@/lib/loader-viewer";
import { PRIVATE_STALE_TIME, PUBLIC_STALE_TIME, queryKeys } from "@/lib/query";
import { pageSeo } from "@/lib/seo";
import type { NotesResponse } from "@/lib/types";
import { NoteCardSkeleton } from "./-components/note-card-skeleton";
import { NotesClient } from "./-components/notes-client";
import { loaderFetchNotesPage } from "./-lib/loader-queries";

export const Route = createFileRoute("/_social/notes")({
  loader: async ({ context }) => {
    const viewerId = await loadViewerId(context.queryClient);

    await context.queryClient.ensureInfiniteQueryData({
      queryKey: queryKeys.notes(viewerId ?? "public"),
      queryFn: ({ pageParam }) =>
        loaderFetchNotesPage((pageParam as string | null) ?? null, !!viewerId),
      initialPageParam: null as string | null,
      getNextPageParam: (lastPage: NotesResponse) =>
        lastPage.nextCursor ?? null,
      staleTime: viewerId ? PRIVATE_STALE_TIME : PUBLIC_STALE_TIME,
    });

    return { viewerId, isAuthenticated: !!viewerId };
  },
  head: () => {
    const seo = pageSeo({
      title: "Umamin — Notes",
      description:
        "Explore notes on Umamin, the open-source platform for sending and receiving encrypted anonymous messages. Send your messages anonymously and discover what others have to share.",
      path: "/notes",
    });
    return {
      ...seo,
      meta: [
        ...seo.meta,
        {
          name: "keywords",
          content:
            "Umamin notes, anonymous notes, send messages, view messages",
        },
      ],
    };
  },
  pendingComponent: NotesPending,
  errorComponent: (props) => (
    <RouteSegmentError {...props} heading="We couldn’t load notes." />
  ),
  component: Notes,
});

function NotesShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader />
      <div className="-mt-8 pt-[env(safe-area-inset-top)] lg:mt-0 lg:pt-0">
        {children}
      </div>
    </>
  );
}

function Notes() {
  const { viewerId, isAuthenticated } = Route.useLoaderData();

  return (
    <NotesShell>
      <div className="container max-w-xl mt-2">
        <ChatAnnouncement className="mb-6" />
        <NotesClient
          initialUserId={viewerId}
          isAuthenticated={isAuthenticated}
        />
      </div>
    </NotesShell>
  );
}

function NotesPending() {
  return (
    <NotesShell>
      <div className="container max-w-xl space-y-12 mt-2">
        <div className="rounded-md border p-4 space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
          <Skeleton className="h-24 w-full" />
        </div>

        <div className="space-y-4">
          <NoteCardSkeleton />
          <NoteCardSkeleton />
          <NoteCardSkeleton />
        </div>
      </div>
    </NotesShell>
  );
}
