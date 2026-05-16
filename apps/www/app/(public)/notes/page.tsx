import { HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import { getDehydratedPublicNotes } from "@/lib/server-fetchers";
import { NotesContent } from "./components/notes-content";

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
  // The prefetch is wrapped in `use cache` with a 5-minute revalidate, so this
  // page stays prerendered and only hits Hono on cache revalidation. Returns
  // null (no dehydrated state) if HONO_API_ORIGIN is unset or unreachable —
  // the client then falls back to a normal infinite query fetch.
  const dehydratedState = await getDehydratedPublicNotes();

  return (
    <div className="container max-w-xl space-y-12">
      <h1 className="font-extrabold sm:text-5xl text-[9vw] leading-none dark:bg-gradient-to-b from-foreground dark:to-zinc-400 bg-zinc-800 bg-clip-text text-transparent tracking-tighter text-center my-6">
        Umamin Notes
      </h1>

      <HydrationBoundary state={dehydratedState}>
        <NotesContent />
      </HydrationBoundary>
    </div>
  );
}
