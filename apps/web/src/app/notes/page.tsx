import { cache } from "react";
import { getClient } from "@/lib/gql";
import { getSession } from "@/lib/auth";
import { NoteForm } from "./components/form";
import { NotesList } from "./components/list";
import { NOTES_QUERY, NOTE_BY_USER_ID_QUERY } from "./queries";

const getNotes = cache(async () => {
  const res = await getClient().query(NOTES_QUERY, {});
  return res;
});

const getNoteByUserId = cache(async (userId: string) => {
  const res = await getClient().query(NOTE_BY_USER_ID_QUERY, { userId });
  return res;
});

export default async function Page() {
  const { user } = await getSession();

  const notesResult = await getNotes();
  const userResult = await getNoteByUserId(user?.id ?? "");

  const notes = notesResult.data?.notes;
  const currentUserNote = userResult.data?.noteByUserId;

  return (
    <main className="mt-28 container max-w-xl mx-auto pb-32">
      {user && (
        <NoteForm
          username={user.username}
          imageUrl={user.imageUrl}
          currentUserNote={currentUserNote}
        />
      )}

      <div className="gap-5 flex flex-col">
        {!notes?.length ? (
          <p className="text-sm text-muted-foreground mt-4 text-center">
            No messages to show
          </p>
        ) : (
          <NotesList currentUserId={user?.id} notes={notes} />
        )}
      </div>
    </main>
  );
}
