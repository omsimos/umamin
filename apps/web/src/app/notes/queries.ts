import { graphql, ResultOf } from "gql.tada";

export const NOTES_QUERY = graphql(`
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
        username
        imageUrl
      }
    }
  }
`);

export const CURRENT_NOTE_QUERY = graphql(`
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

export type NoteQueryResult = ResultOf<typeof NOTES_QUERY>["notes"][0];
export type CurrentNoteQueryResult = ResultOf<
  typeof CURRENT_NOTE_QUERY
>["note"];
