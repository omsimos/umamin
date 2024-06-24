import { ResultOf, graphql } from "gql.tada";

import { sentMessageFragment } from "./components/sent/card";
import { receivedMessageFragment } from "./components/received/card";

export const RECEIVED_MESSAGES_QUERY = graphql(
  `
    query RecentMessages($type: String!) {
      messages(type: $type) {
        __typename
        id
        createdAt
        ...MessageFragment
      }
    }
  `,
  [receivedMessageFragment],
);

export const SENT_MESSAGES_QUERY = graphql(
  `
    query Messages($type: String!) {
      messages(type: $type) {
        __typename
        id
        createdAt
        ...SentMessageFragment
      }
    }
  `,
  [sentMessageFragment],
);

export type ReceivedMessagesResult = ResultOf<
  typeof RECEIVED_MESSAGES_QUERY
>["messages"];

export type SentMessageResult = ResultOf<
  typeof SENT_MESSAGES_QUERY
>["messages"];
