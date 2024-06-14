import { cache } from "react";
import { cookies } from "next/headers";

import { getSession, lucia } from "@/lib/auth";
import { getClient } from "@/lib/gql/rsc";
import { NoteForm } from "./components/form";
import { NotesList } from "./components/list";
import { NOTES_QUERY, CURRENT_NOTE_QUERY } from "./queries";

const getNotes = cache(async () => {
  const res = await getClient().query(NOTES_QUERY, {});
  return res;
});

const getCurrentNote = cache(async () => {
  const sessionId = cookies().get(lucia.sessionCookieName)?.value ?? "";
  const res = await getClient(sessionId).query(CURRENT_NOTE_QUERY, {});

  return res;
});

export default async function Page() {
  const { user } = await getSession();
  const notesResult = await getNotes();
  const currentNoteResult = await getCurrentNote();

  const notes = notesResult.data?.notes;
  const currentNote = currentNoteResult.data?.note;

  return (
    <main className="mt-28 container max-w-xl mx-auto pb-32">
      {user && (
        <NoteForm
          username={user.username}
          imageUrl={user?.imageUrl}
          currentNote={currentNote}
        />
      )}

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
