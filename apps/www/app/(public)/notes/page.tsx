import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import { getQueryClient } from "@/lib/get-query-client";
import { queryKeys } from "@/lib/query";
import { fetchPublicNotesPageServer } from "@/lib/server-fetchers";
import { NotesContent } from "./components/notes-content";

// ISR: regenerate the static HTML + dehydrated cache at most once per minute.
// Keeps Vercel function invocations at zero for the steady-state cached path.
export const revalidate = 60;

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

export default async function Page() {
  const queryClient = getQueryClient();

  try {
    const firstPage = await fetchPublicNotesPageServer(60);
    queryClient.setQueryData(queryKeys.notes("public"), {
      pages: [firstPage],
      pageParams: [null],
    });
  } catch {
    // Fall through to client-side fetch on the rare Hono outage during ISR.
  }

  return (
    <div className="container max-w-xl space-y-12">
      <h1 className="font-extrabold sm:text-5xl text-[9vw] leading-none dark:bg-gradient-to-b from-foreground dark:to-zinc-400 bg-zinc-800 bg-clip-text text-transparent tracking-tighter text-center my-6">
        Umamin Notes
      </h1>

      <HydrationBoundary state={dehydrate(queryClient)}>
        <NotesContent />
      </HydrationBoundary>
    </div>
  );
}
