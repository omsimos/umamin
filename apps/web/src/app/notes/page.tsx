import { Suspense } from "react";
import { graphql } from "gql.tada";

import { NoteItem } from "./components/note-item";
import { NoteForm } from "./components/note-form";
import { Skeleton } from "@ui/components/ui/skeleton";
import { NotesList } from "./components/notes-list";
import { getClient } from "@/lib/gql";

const USERS_WITH_NOTE_QUERY = graphql(`
  query UsersWithNote {
    usersWithNote {
      __typename
      id
      note
      username
      imageUrl
      updatedAt
    }
  }
`);

export default async function Page() {
  const result = await getClient().query(USERS_WITH_NOTE_QUERY, {});
  const users = result.data?.usersWithNote;

  return (
    <Suspense
      fallback={
        <div className="mt-28 mx-auto container max-w-xl">
          <NoteForm />

          <div className="gap-5 flex flex-col">
            <Skeleton className="w-full h-[200px] rounded-lg" />
            <Skeleton className="w-full h-[200px] rounded-lg" />
            <Skeleton className="w-full h-[200px] rounded-lg" />
          </div>
        </div>
      }
    >
      <main className="mt-28 container max-w-xl mx-auto">
        <NoteForm />

        <div className="gap-5 flex flex-col">
          {!users?.length ? (
            <p className="text-sm text-muted-foreground mt-4 text-center">
              No messages to show
            </p>
          ) : (
            <>
              {users?.map((user) => (
                <NoteItem
                  key={user.id}
                  username={user.username}
                  note={user.note!}
                  imageUrl={user.imageUrl}
                />
              ))}
              <NotesList users={users} />
            </>
          )}
        </div>
      </main>
    </Suspense>
  );
}
