import { cache } from "react";
import getClient from "@/lib/gql/rsc";
import { ResultOf, graphql } from "gql.tada";

import { sentMessageFragment } from "./components/sent/card";
import { receivedMessageFragment } from "./components/received/card";

const RECEIVED_MESSAGES_QUERY = graphql(
  `
    query ReceivedMessages($type: String!) {
      messages(type: $type) {
        __typename
        id
        createdAt
        ...MessageFragment
      }
    }
  `,
  [receivedMessageFragment]
);

const SENT_MESSAGES_QUERY = graphql(
  `
    query SentMessages($type: String!) {
      messages(type: $type) {
        __typename
        id
        createdAt
        ...SentMessageFragment
      }
    }
  `,
  [sentMessageFragment]
);

const receivedMessagesPersisted = graphql.persisted(
  "f07a17f7e44b839d7a1449115b9810d55447696a558d7416f16dc0b9c978217f",
  RECEIVED_MESSAGES_QUERY
);

const sentMessagesPersisted = graphql.persisted(
  "05e86ea80c5038a466e952fe9fceeb57d537e1afbe6575df5f27b44944a1531f",
  SENT_MESSAGES_QUERY
);

export const getReceivedMessages = cache(async (sessionId?: string) => {
  const result = await getClient(sessionId).query(receivedMessagesPersisted, {
    type: "received",
  });

  return result?.data?.messages;
});

export const getSentMessages = cache(async (sessionId?: string) => {
  const result = await getClient(sessionId).query(sentMessagesPersisted, {
    type: "sent",
  });

  return result?.data?.messages;
});

export type ReceivedMessagesResult = ResultOf<
  typeof RECEIVED_MESSAGES_QUERY
>["messages"];

export type SentMessageResult = ResultOf<
  typeof SENT_MESSAGES_QUERY
>["messages"];

type Cursor = {
  id: string | null;
  createdAt: number | null;
};

export type InboxProps<T = "received" | "sent"> = {
  messages?: T extends "received" ? ReceivedMessagesResult : SentMessageResult;
  initialCursor: Cursor;
};
