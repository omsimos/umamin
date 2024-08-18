import { cache } from "react";
import getClient from "@/lib/gql/rsc";
import { ResultOf, graphql } from "gql.tada";

import { receivedMessageFragment } from "./components/received/card";

const RECEIVED_MESSAGES_QUERY = graphql(
  `
    query ReceivedMessages($type: String!) {
      messages(type: $type, limit: 20) {
        __typename
        id
        createdAt
        ...MessageFragment
      }
    }
  `,
  [receivedMessageFragment]
);

const receivedMessagesPersisted = graphql.persisted(
  "f07a17f7e44b839d7a1449115b9810d55447696a558d7416f16dc0b9c978217f",
  RECEIVED_MESSAGES_QUERY
);

export const getReceivedMessages = cache(async (sessionId?: string) => {
  const result = await getClient(sessionId).query(receivedMessagesPersisted, {
    type: "received",
  });

  return result?.data?.messages;
});

export type ReceivedMessagesResult = ResultOf<
  typeof RECEIVED_MESSAGES_QUERY
>["messages"];
