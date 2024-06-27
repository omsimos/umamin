import Link from "next/link";
import { cache } from "react";
import dynamic from "next/dynamic";
import { cookies } from "next/headers";
import { SquarePen } from "lucide-react";

import { getClient } from "@/lib/gql/rsc";
import { NoteForm } from "./components/form";
import { NotesList } from "./components/list";
import { getSession, lucia } from "@/lib/auth";
import { Button } from "@umamin/ui/components/button";
import { NOTES_QUERY, CURRENT_NOTE_QUERY } from "./queries";

const AdContainer = dynamic(() => import("@umamin/ui/ad"));

const getNotes = cache(async () => {
  const res = await getClient().query(NOTES_QUERY, {});
  return res;
});

const getCurrentNote = cache(async () => {
  const sessionId = cookies().get(lucia.sessionCookieName)?.value ?? "";
  if (!sessionId) {
    return null;
  }

  const res = await getClient(sessionId).query(CURRENT_NOTE_QUERY, {});

  return res;
});

export default async function Page() {
  const { user } = await getSession();
  const notesResult = await getNotes();
  const currentNoteResult = await getCurrentNote();

  const notes = notesResult.data?.notes;
  const currentNote = currentNoteResult?.data?.note;

  return (
    <main className="mt-28 max-w-xl mx-auto pb-32">
      {user ? (
        <NoteForm user={user} currentNote={currentNote} />
      ) : (
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
      )}

      {/* v2-notes */}
      <AdContainer className="mb-5" slotId="1999152698" />

      <div className="gap-5 flex flex-col">
        {!notes?.length ? (
          <p className="text-sm text-muted-foreground mt-4 text-center">
            No notes to show
          </p>
        ) : (
          <NotesList currentUserId={user?.id} notes={notes} />
        )}
      </div>
    </main>
  );
}
