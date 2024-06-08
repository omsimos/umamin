import { graphql, ResultOf } from "gql.tada";

export const NOTES_QUERY = graphql(`
  query Notes {
    notes {
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
  }
`);

export const NOTE_BY_USER_ID_QUERY = graphql(`
  query NoteByUserId($userId: String!) {
    noteByUserId(userId: $userId) {
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
  }
`);

export type NoteQueryResult = ResultOf<typeof NOTES_QUERY>["notes"][0];
export type NoteByUserIdQueryResult = ResultOf<typeof NOTE_BY_USER_ID_QUERY>["noteByUserId"];
