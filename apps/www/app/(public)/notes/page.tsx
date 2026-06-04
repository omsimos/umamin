import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { ChatAnnouncement } from "@/components/chat-announcement";
import { getQueryClient } from "@/lib/get-query-client";
import { queryKeys } from "@/lib/query";
import type { NotesResponse } from "@/lib/query-types";
import { getNotesPage } from "@/lib/server/data";
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

// Cache Component: prefetching stamps Date.now() into the dehydrated state,
// which a static prerender forbids outside a cached scope. Caching the
// hydration here also bakes the public first page into the shell, revalidated
// by the "notes" tag.
async function HydratedNotes() {
  "use cache";
  cacheTag("notes");
  cacheLife({ revalidate: 120 });

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
      <HydratedNotes />
    </div>
  );
}
