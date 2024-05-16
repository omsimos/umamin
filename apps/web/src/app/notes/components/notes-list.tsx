"use client";

import { toast } from "sonner";
import { getClient } from "@/lib/gql";
import { useEffect, useState } from "react";
import { ResultOf, graphql } from "gql.tada";
import { useInView } from "react-intersection-observer";

import { NoteItem } from "./note-item";
import { Skeleton } from "@ui/components/ui/skeleton";

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

export function NotesList({
  users,
}: {
  users: ResultOf<
    typeof USERS_WITH_NOTE_FROM_CURSOR_MUTATION
  >["usersWithNoteFromCursor"]["data"];
}) {
  const { ref, inView } = useInView();

  const [cursor, setCursor] = useState({
    id: users[users.length - 1].id,
    updatedAt: users[users.length - 1].updatedAt!,
  });

  const [userList, setUserList] = useState<typeof users>([]);
  const [hasMore, setHasMore] = useState(users?.length === 5);
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    if (hasMore) {
      setIsFetching(true);

      getClient()
        .mutation(USERS_WITH_NOTE_FROM_CURSOR_MUTATION, {
          cursor,
        })
        .then((res) => {
          if (res.error) {
            toast.error(res.error.message);
            setIsFetching(false);
            return;
          }

          const _cursor = res.data?.usersWithNoteFromCursor.cursor;

          if (_cursor) {
            setCursor({
              id: _cursor?.id ?? "",
              updatedAt: _cursor?.updatedAt ?? "",
            });

            setHasMore(_cursor?.hasMore);
          }

          if (res.data) {
            setUserList([
              ...userList,
              ...res.data.usersWithNoteFromCursor.data,
            ]);
          }

          setIsFetching(false);
        });
    }
  }, [hasMore, inView, userList]);

  return (
    <>
      {userList?.map((user) => (
        <NoteItem
          key={user.id}
          username={user.username}
          note={user.note!}
          imageUrl={user.imageUrl}
        />
      ))}

      {isFetching && <Skeleton className="w-full h-[200px] rounded-lg" />}
      {hasMore && <div ref={ref}></div>}
    </>
  );
}
