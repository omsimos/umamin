import { graphql, ResultOf } from "gql.tada";

export const CURRENT_USER_QUERY = graphql(`
  query CurrentUser {
    user {
      __typename
      id
      bio
      username
      displayName
      question
      quietMode
      imageUrl
      createdAt
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

export type CurrentUserResult = ResultOf<typeof CURRENT_USER_QUERY>["user"];
