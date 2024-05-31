"use client";

import { toast } from "sonner";
import { graphql } from "gql.tada";
import { getClient } from "@/lib/gql";
import { useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";

import { NoteCard } from "./card";
import { NoteQueryResult } from "../queries";
import { Skeleton } from "@ui/components/ui/skeleton";

const NOTES_FROM_CURSOR_MUTATION = graphql(`
  mutation NotesFromCursor($cursor: NotesFromCursorInput!) {
    notesFromCursor(cursor: $cursor) {
      __typename
      data {
        __typename
        id
        userId
        content
        updatedAt
        isAnonymous
        user {
          __typename
          id
          username
          imageUrl
        }
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

type Props = {
  currentUserId?: string;
  notes: NoteQueryResult[];
};

export function NotesList({ currentUserId, notes }: Props) {
  const { ref, inView } = useInView();

  const [cursor, setCursor] = useState({
    id: notes[notes.length - 1].id,
    updatedAt: notes[notes.length - 1].updatedAt!,
  });

  const [notesList, setNotesList] = useState(notes);
  const [hasMore, setHasMore] = useState(notes?.length === 10);
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    if (hasMore) {
      setIsFetching(true);

      getClient()
        .mutation(NOTES_FROM_CURSOR_MUTATION, {
          cursor,
        })
        .then((res) => {
          if (res.error) {
            toast.error(res.error.message);
            setIsFetching(false);
            return;
          }

          const _cursor = res.data?.notesFromCursor.cursor;

          if (_cursor && _cursor.updatedAt) {
            setCursor({
              id: _cursor?.id ?? "",
              updatedAt: _cursor?.updatedAt,
            });

            setHasMore(_cursor?.hasMore);
          }

          if (res.data) {
            setNotesList([...notesList, ...res.data.notesFromCursor.data]);
          }

          setIsFetching(false);
        });
    }
  }, [hasMore, inView, notesList]);

  return (
    <>
      {notesList
        ?.filter((u) => u.userId !== currentUserId)
        .map((note) => (
          <NoteCard
            key={note.id}
            updatedAt={note.updatedAt}
            username={note?.user?.username ?? ""}
            isAnonymous={note.isAnonymous}
            note={note.content}
            imageUrl={note?.user?.imageUrl}
          />
        ))}

      {isFetching && <Skeleton className="w-full h-[200px] rounded-lg" />}
      {hasMore && <div ref={ref}></div>}
    </>
  );
}
