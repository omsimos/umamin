"use client";

import { toast } from "sonner";
import { graphql } from "gql.tada";
import client from "@/lib/gql/client";
import { useInView } from "react-intersection-observer";
import { useCallback, useEffect, useState } from "react";

import { NoteCard } from "./card";
import { formatError } from "@/lib/utils";
import { NotesQueryResult } from "../queries";
import { Skeleton } from "@umamin/ui/components/skeleton";

const NOTES_FROM_CURSOR_QUERY = graphql(`
  query NotesFromCursor($cursor: NotesFromCursorInput!) {
    notesFromCursor(cursor: $cursor) {
      __typename
      data {
        __typename
        id
        content
        updatedAt
        isAnonymous
        user {
          __typename
          id
          displayName
          quietMode
          username
          imageUrl
        }
      }
      hasMore
      cursor {
        __typename
        id
        updatedAt
      }
    }
  }
`);

const notesFromCursorPersisted = graphql.persisted(
  "262877a65aad9be976828c1e5854027f21dc0cd3edcd6991b4ada34ecfe67157",
  NOTES_FROM_CURSOR_QUERY
);

type Cursor = {
  id: string | null;
  updatedAt: number | null;
};

type Props = {
  currentUserId?: string;
  initialCursor: Cursor;
  initialHasMore?: boolean;
};

export function NotesList({
  currentUserId,
  initialCursor,
  initialHasMore,
}: Props) {
  const { ref, inView } = useInView();

  const [cursor, setCursor] = useState(initialCursor);

  const [notesList, setNotesList] = useState<NotesQueryResult>([]);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isFetching, setIsFetching] = useState(false);

  const loadNotes = useCallback(async () => {
    if (hasMore) {
      setIsFetching(true);

      const res = await client.query(notesFromCursorPersisted, {
        cursor,
      });

      if (res.error) {
        toast.error(formatError(res.error.message));
        return;
      }

      const _res = res.data?.notesFromCursor;

      if (_res?.cursor) {
        setCursor({
          id: _res.cursor.id,
          updatedAt: _res.cursor.updatedAt,
        });

        setHasMore(_res.hasMore);
      }

      if (_res?.data) {
        setNotesList((prev) => [...prev, ...(_res.data ?? [])]);
      }

      setIsFetching(false);
    }
  }, [cursor, hasMore, notesList]);

  useEffect(() => {
    if (inView && !isFetching) {
      loadNotes();
    }
  }, [inView, isFetching]);

  return (
    <>
      {notesList
        ?.filter((u) => u.user?.id !== currentUserId)
        .map((note) => (
          <div key={note.id} className="w-full">
            <NoteCard note={note} currentUserId={currentUserId} />
          </div>
        ))}

      {isFetching && (
        <div className="container">
          <Skeleton className="w-full h-[150px] rounded-lg" />
        </div>
      )}
      {hasMore && <div ref={ref}></div>}
    </>
  );
}
