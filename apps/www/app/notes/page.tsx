import type { Metadata } from "next";
import { NoteForm } from "./components/note-form";
import { NoteList } from "./components/note-list";
import { getSession } from "@/lib/auth";
import { SquarePenIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

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
  const { session } = await getSession();

  return (
    <div className="container max-w-xl space-y-12">
      {session ? (
        <NoteForm />
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
      <NoteList isAuthenticated={!!session} />
    </div>
  );
}
