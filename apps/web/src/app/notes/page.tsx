"use client";

import { nanoid } from "nanoid";
import { graphql } from "gql.tada";
import { useMutation, useQuery } from "@urql/next";
import { Suspense, useEffect, useMemo, useState } from "react";
import { NoteItem } from "./components/note-item";
import { NoteForm } from "./components/note-form";
import { Skeleton } from "@ui/components/ui/skeleton";
import { useInView } from "react-intersection-observer";
import { toast } from "sonner";

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
      updatedAt
    }
  }
`);

const USERS_WITH_NOTE_FROM_CURSOR_MUTATION = graphql(`
  mutation UsersWithNoteFromCursor($cursor: UsersWithNoteFromCursorInput!) {
    usersWithNoteFromCursor(cursor: $cursor) {
      __typename
      data {
        __typename
        id
        note
        username
        imageUrl
        updatedAt
      }
      cursor {
        __typename
        id
        hasMore
        updatedAt
      }
    }
  }
`);

function Notes() {
  const { ref, inView } = useInView();
  const [result] = useQuery({ query: USERS_WITH_NOTE_QUERY });

  const [res, loadMore] = useMutation(USERS_WITH_NOTE_FROM_CURSOR_MUTATION);

  const users = result.data?.usersWithNote;

  const [cursor, setCursor] = useState(
    users && {
      id: users[users.length - 1].id,
      updatedAt: users[users.length - 1].updatedAt,
    },
  );

  const [userList, setUserList] = useState(users);

  const hasMore =
    userList?.length === 5 || res.data?.usersWithNoteFromCursor.cursor.hasMore;

  useEffect(() => {
    if (hasMore && userList && inView && cursor?.updatedAt) {
      loadMore({
        cursor: {
          id: cursor.id,
          updatedAt: cursor.updatedAt,
        },
      }).then((res) => {
        if (res.error) {
          toast.error(res.error.message);
          return;
        }

        const _cursor = res.data?.usersWithNoteFromCursor.cursor;

        if (_cursor) {
          setCursor({
            id: _cursor?.id,
            updatedAt: _cursor?.updatedAt,
          });
        }

        if (res.data) {
          setUserList([...userList, ...res.data.usersWithNoteFromCursor.data]);
        }
      });
    }
  }, [hasMore, inView, userList]);

  return (
    <main className="mt-28 container max-w-xl mx-auto">
      <NoteForm />

      <div className="gap-5 flex flex-col">
        {!userList?.length && (
          <p className="text-sm text-muted-foreground mt-4">
            No messages to show
          </p>
        )}

        {userList?.map((user) => (
          <NoteItem
            key={user.id}
            username={user.username}
            note={user.note!}
            imageUrl={user.imageUrl}
          />
        ))}

        {res.fetching && <Skeleton className="w-full h-[200px] rounded-lg" />}
        {hasMore && <div ref={ref}></div>}
      </div>
    </main>
  );
}
