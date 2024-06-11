import { graphql, ResultOf } from "gql.tada";

export const USER_BY_ID_QUERY = graphql(`
  query UserById($id: String!) {
    userById(id: $id) {
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

export type UserByIdResult = ResultOf<typeof USER_BY_ID_QUERY>["userById"];
