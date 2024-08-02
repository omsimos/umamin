import Link from "next/link";
import dynamic from "next/dynamic";
import { SquarePen } from "lucide-react";

import { getSession } from "@/lib/auth";
import { NoteCard } from "./components/card";
import { NotesList } from "./components/list";
import { getNotes, getCurrentNote } from "./queries";
import { Button } from "@umamin/ui/components/button";

const NoteForm = dynamic(() => import("./components/form"));
const AdContainer = dynamic(() => import("@umamin/ui/ad"), {
  ssr: false,
});

export const metadata = {
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
  const { user, session } = await getSession();

  const notes = await getNotes();
  const currentNote = await getCurrentNote(session?.id);

  return (
    <main className="mt-28 max-w-xl mx-auto pb-32">
      <h1 className="font-extrabold sm:text-5xl text-[9vw] leading-none dark:bg-gradient-to-b from-foreground dark:to-zinc-400 bg-zinc-800 bg-clip-text text-transparent tracking-tighter text-center my-6">
        Umamin Notes
      </h1>

      {user ? (
        <NoteForm user={user} currentNote={currentNote} />
      ) : (
        <div className="container">
          <div className="flex items-center space-x-4 rounded-md border p-4 mb-5">
            <SquarePen />
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
        </div>
      )}

      {/* v2-notes */}
      <AdContainer className="mb-5" slotId="1999152698" />

      <div className="gap-5 flex flex-col">
        {!notes?.length ? (
          <p className="text-sm text-muted-foreground mt-4 text-center">
            No notes to show
          </p>
        ) : (
          <>
            {notes
              ?.filter((u) => u.user?.id !== user?.id)
              .map((note, i) => (
                <div key={note.id} className="w-full">
                  <NoteCard note={note} currentUserId={user?.id} />

                  {/* v2-notes-list */}
                  {(i + 1) % 5 === 0 && (
                    <AdContainer className="mt-5" slotId="9012650581" />
                  )}
                </div>
              ))}

            <NotesList
              currentUserId={user?.id}
              initialCursor={{
                id: notes[notes.length - 1]?.id ?? null,
                updatedAt: notes[notes.length - 1]?.updatedAt ?? null,
              }}
              initialHasMore={notes.length === 20}
            />
          </>
        )}
      </div>
    </main>
  );
}
