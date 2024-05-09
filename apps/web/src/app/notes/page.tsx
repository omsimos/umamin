"use client";

import { nanoid } from "nanoid";
import { graphql } from "gql.tada";
import { useQuery } from "@urql/next";
import { Suspense, useMemo } from "react";
import { NoteItem } from "./components/note-item";
import { NoteForm } from "./components/note-form";
import { Skeleton } from "@ui/components/ui/skeleton";

export default function Page() {
  const ids = useMemo(() => Array.from({ length: 3 }).map(() => nanoid()), []);

  return (
    <Suspense
      fallback={
        <div className="mt-28 mx-auto container max-w-xl">
          <NoteForm />

          <div className="gap-5 flex flex-col">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={ids[i]} className="w-full h-[200px] rounded-lg" />
            ))}
          </div>
        </div>
      }
    >
      <Notes />
    </Suspense>
  );
}

const USERS_WITH_NOTE_QUERY = graphql(`
  query UsersWithNote {
    usersWithNote {
      __typename
      id
      note
      username
      imageUrl
    }
  }
`);

function Notes() {
  const [result] = useQuery({ query: USERS_WITH_NOTE_QUERY });

  return (
    <main className="mt-28 container max-w-xl mx-auto">
      <NoteForm />

      <div className="gap-5 flex flex-col">
        {result.data?.usersWithNote?.map((user) => (
          <NoteItem
            key={user.id}
            username={user.username}
            note={user.note!}
            imageUrl={user.imageUrl}
          />
        ))}
      </div>
    </main>
  );
}
