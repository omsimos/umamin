import { ResultOf, graphql } from "gql.tada";

export const USER_BY_USERNAME_QUERY = graphql(`
  query UserByUsername($username: String!) {
    userByUsername(username: $username) {
      id
      username
      displayName
      question
      quietMode
      imageUrl
      createdAt
    }
  }
`);

export type UserByUsernameQueryResult = ResultOf<
  typeof USER_BY_USERNAME_QUERY
>["userByUsername"];
