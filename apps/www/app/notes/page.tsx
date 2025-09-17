import type { Metadata } from "next";
import { NoteForm } from "./components/note-form";
import { NoteList } from "./components/note-list";
import { getSession } from "@/lib/auth";
import { SquarePenIcon } from "lucide-react";
import { Button } from "@umamin/ui/components/button";
import Link from "next/link";
import { CurrentUserNote } from "./components/current-user-note";

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
  const { user } = await getSession();

  return (
    <div className="container max-w-xl space-y-12">
      <h1 className="font-extrabold sm:text-5xl text-[9vw] leading-none dark:bg-gradient-to-b from-foreground dark:to-zinc-400 bg-zinc-800 bg-clip-text text-transparent tracking-tighter text-center my-6">
        Umamin Notes
      </h1>

      {user ? (
        <>
          <NoteForm />
          <CurrentUserNote currentUser={user} />
        </>
      ) : (
        <div className="flex items-center space-x-4 rounded-md border p-4 mb-5">
          <SquarePenIcon />
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium leading-none">Umamin Notes</p>
            <p className="text-sm text-muted-foreground">
              Login to start writing notes
            </p>
          </div>

          <Button asChild>
            <Link href="/login">Login</Link>
          </Button>
        </div>
      )}
      <NoteList isAuthenticated={!!user} />
    </div>
  );
}
