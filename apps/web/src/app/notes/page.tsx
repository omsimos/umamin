import { graphql } from "gql.tada";
import { Suspense, cache } from "react";

import { getClient } from "@/lib/gql";
import { getSession } from "@/lib/auth";
import { NoteForm } from "./components/note-form";
import { NotesList } from "./components/notes-list";
import { Skeleton } from "@ui/components/ui/skeleton";

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

const getUsersWithNote = cache(async () => {
  const res = await getClient().query(USERS_WITH_NOTE_QUERY, {});
  return res;
});

export default async function Page() {
  const { user } = await getSession();
  const result = await getUsersWithNote();
  const users = result.data?.usersWithNote?.filter((u) => u.id !== user?.id);

  return (
    <Suspense
      fallback={
        <div className="mt-28 mx-auto container max-w-xl">
r         {user && <NoteForm />}

          <div className="gap-5 flex flex-col">
            <Skeleton className="w-full h-[200px] rounded-lg" />
            <Skeleton className="w-full h-[200px] rounded-lg" />
            <Skeleton className="w-full h-[200px] rounded-lg" />
          </div>
        </div>
      }
    >
      <main className="mt-28 container max-w-xl mx-auto pb-32">
        {user && <NoteForm user={user} />}

        <div className="gap-5 flex flex-col">
          {!users?.length ? (
            <p className="text-sm text-muted-foreground mt-4 text-center">
              No messages to show
            </p>
          ) : (
            <NotesList currentUserId={user?.id} users={users} />
          )}
        </div>
      </main>
    </Suspense>
  );
}
