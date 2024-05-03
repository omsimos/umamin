import { graphql } from "gql.tada";
import { ResultOf } from "gql.tada";
import { registerUrql } from "@urql/next/rsc";
import { cacheExchange } from "@urql/exchange-graphcache";
import { createClient, fetchExchange } from "@urql/core";

const origin = process.env.NEXT_PUBLIC_VERCEL_URL;

const makeClient = () => {
  return createClient({
    url: origin
      ? `https://${origin}/api/graphql`
      : "http://localhost:3000/api/graphql",
    exchanges: [cacheExchange({}), fetchExchange],
  });
};

export const { getClient } = registerUrql(makeClient);

export const UserByUsernameQuery = graphql(`
  query UserByUsername($username: String!) {
    userByUsername(username: $username) {
      __typename
      id
      bio
      username
      imageUrl
      createdAt
    }
  }
`);

export type UserByUsernameResult = Omit<
  NonNullable<ResultOf<typeof UserByUsernameQuery>["userByUsername"]>,
  "__typename"
>;
