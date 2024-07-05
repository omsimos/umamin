"use client";

import { toast } from "sonner";
import dynamic from "next/dynamic";
import { graphql } from "gql.tada";
import { client } from "@/lib/gql/client";
import { useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";

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
  const [hasMore, setHasMore] = useState(notes?.length === 10);
  const [isFetching, setIsFetching] = useState(false);

  function loadNotes() {
    if (hasMore) {
      setIsFetching(true);

      client
        .query(NOTES_FROM_CURSOR_QUERY, {
          cursor,
        })
        .toPromise()
        .then((res) => {
          if (res.error) {
            toast.error(res.error.message);
            setIsFetching(false);
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
        });
    }
  }

  useEffect(() => {
    if (inView) {
      loadNotes();
    }
  }, [inView]);

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

            {/* v2-note-feed */}
            {(i + 1) % 5 === 0 && (
              <AdContainer className="mt-5" slotId="4344956885" />
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
