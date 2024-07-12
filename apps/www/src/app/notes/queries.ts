import { cache } from "react";
import getClient from "@/lib/gql/rsc";
import { graphql, ResultOf } from "gql.tada";

const NOTES_QUERY = graphql(`
  query Notes {
    notes {
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
  }
`);

const CURRENT_NOTE_QUERY = graphql(`
  query CurrentNote {
    note {
      __typename
      id
      content
      updatedAt
      isAnonymous
    }
  }
`);

const currentNotePersisted = graphql.persisted(
  "e341bcbefcb9ca743aaf5e281b372e9327b541708538e9f70f11d411d1f21ea0",
  CURRENT_NOTE_QUERY,
);

const notesPersisted = graphql.persisted(
  "1d9ebe0bebd8b210f11924e100d0026c50fc6ea80b537dbafee4062ddc06d8f8",
  NOTES_QUERY,
);

export const getCurrentNote = cache(async (sessionId?: string) => {
  if (!sessionId) {
    return null;
  }

  const res = await getClient(sessionId).query(currentNotePersisted, {});
  return res.data?.note;
});

export const getNotes = cache(async () => {
  const notesResult = await getClient().query(notesPersisted, {});

  return notesResult.data?.notes;
});

export type NotesQueryResult = ResultOf<typeof NOTES_QUERY>["notes"];
export type CurrentNoteQueryResult = ResultOf<
  typeof CURRENT_NOTE_QUERY
>["note"];
