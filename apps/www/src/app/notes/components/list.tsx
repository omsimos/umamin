"use client";

import { toast } from "sonner";
import dynamic from "next/dynamic";
import { graphql } from "gql.tada";
import client from "@/lib/gql/client";
import { useInView } from "react-intersection-observer";
import { useCallback, useEffect, useState } from "react";

import { NoteCard } from "./card";
import { NoteQueryResult } from "../queries";
import { Skeleton } from "@umamin/ui/components/skeleton";

const AdContainer = dynamic(() => import("@umamin/ui/ad"), { ssr: false });

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

type Props = {
  currentUserId?: string;
  notes: NoteQueryResult[];
};

export function NotesList({ currentUserId, notes }: Props) {
  const { ref, inView } = useInView();

  const [cursor, setCursor] = useState({
    id: notes[notes.length - 1]?.id ?? null,
    updatedAt: notes[notes.length - 1]?.updatedAt ?? null,
  });

  const [notesList, setNotesList] = useState(notes);
  const [hasMore, setHasMore] = useState(notes?.length === 20);
  const [isFetching, setIsFetching] = useState(false);

  const loadNotes = useCallback(async () => {
    if (hasMore) {
      setIsFetching(true);

      const res = await client.query(NOTES_FROM_CURSOR_QUERY, {
        cursor,
      });

      if (res.error) {
        toast.error(res.error.message);
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
        setNotesList([...notesList, ..._res.data]);
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
        .map((note, i) => (
          <div key={note.id} className="w-full">
            <NoteCard
              note={note}
              user={{ ...note.user }}
              currentUserId={currentUserId}
            />

            {/* v2-notes-feed */}
            {(i + 1) % 5 === 0 && (
              <AdContainer inFeed className="mt-5" slotId="4344956885" />
            )}
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
