import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { ChatAnnouncement } from "@/components/chat-announcement";
import { getQueryClient } from "@/lib/get-query-client";
import { queryKeys } from "@/lib/query";
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

// Request-time hole (like /feed's searchParams access): a build-time prefetch
// would need a live, migrated, authorized Turso during `next build` — CI broke
// on exactly that. The data itself still comes from the shared "use cache"
// page, so per-request cost stays one cache read.
async function HydratedNotes() {
  await connection();

  const queryClient = getQueryClient();

  await queryClient.prefetchInfiniteQuery({
    queryKey: queryKeys.notes(),
    queryFn: ({ pageParam }) =>
      getNotesPage({
        cursor: (pageParam as string | null) ?? null,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: NotesResponse) => lastPage.nextCursor ?? null,
    staleTime: 120_000,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <NotesClient />
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
