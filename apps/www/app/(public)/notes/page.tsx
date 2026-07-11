import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ChatAnnouncement } from "@/components/chat-announcement";
import { getSession } from "@/lib/auth";
import { getQueryClient } from "@/lib/get-query-client";
import { PRIVATE_STALE_TIME, PUBLIC_STALE_TIME, queryKeys } from "@/lib/query";
import type { NotesResponse } from "@/lib/query-types";
import { getNotesPage } from "@/lib/server/data";
import { NoteCardSkeleton } from "./components/note-card-skeleton";
import { NotesClient } from "./components/notes-client";

export const metadata: Metadata = {
  title: "Umamin — Notes",
  description:
    "Explore notes on Umamin, the open-source platform for sending and receiving encrypted anonymous messages. Send your messages anonymously and discover what others have to share.",
  keywords: [
    "Umamin notes",
    "anonymous notes",
    "send messages",
    "view messages",
  ],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    title: "Umamin — Notes",
    description:
      "Explore notes on Umamin, the open-source platform for sending and receiving encrypted anonymous messages. Send your messages anonymously and discover what others have to share.",
    url: "https://www.umamin.link/notes",
  },
  twitter: {
    card: "summary_large_image",
    title: "Umamin — Notes",
    description:
      "Explore notes on Umamin, the open-source platform for sending and receiving encrypted anonymous messages. Send your messages anonymously and discover what others have to share.",
  },
};

// Session-dependent prefetch in a request-time hole: reading cookies via
// getSession forces request-time rendering (so a build-time prefetch can't hit
// a live Turso — CI broke on exactly that) AND lets us hydrate the exact
// viewer-keyed query the client renders, so an authed first page is served once
// from SSR instead of re-fetched under a different key. The data itself still
// comes from the shared "use cache" page, so per-request cost stays cache reads.
async function HydratedNotes() {
  const { user } = await getSession();
  const viewerId = user?.id ?? null;

  const queryClient = getQueryClient();

  await queryClient.prefetchInfiniteQuery({
    queryKey: queryKeys.notes(viewerId ?? "public"),
    queryFn: ({ pageParam }) =>
      getNotesPage({
        cursor: (pageParam as string | null) ?? null,
        viewerId,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: NotesResponse) => lastPage.nextCursor ?? null,
    staleTime: viewerId ? PRIVATE_STALE_TIME : PUBLIC_STALE_TIME,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <NotesClient initialUserId={viewerId} isAuthenticated={!!user} />
    </HydrationBoundary>
  );
}

// No session work here (mirrors /feed): the shell carries only public data;
// NotesClient resolves the viewer in the browser and re-keys its queries per
// viewer.
export default function Page() {
  return (
    <div className="container max-w-xl mt-2">
      <ChatAnnouncement className="mb-6" />
      <Suspense
        fallback={
          <div className="space-y-4">
            <NoteCardSkeleton />
            <NoteCardSkeleton />
            <NoteCardSkeleton />
          </div>
        }
      >
        <HydratedNotes />
      </Suspense>
    </div>
  );
}
