import { graphql, ResultOf } from "gql.tada";

export const CURRENT_USER_QUERY = graphql(`
  query CurrentUser {
    currentUser {
      __typename
      id
      username
      bio
      question
      quietMode
      imageUrl
      createdAt
      updatedAt
      accounts {
        __typename
        id
        email
        picture
        createdAt
      }
    }
  }
`);

export type CurrentUserResult = ResultOf<
  typeof CURRENT_USER_QUERY
>["currentUser"];
