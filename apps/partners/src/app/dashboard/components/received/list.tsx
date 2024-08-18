"use client";

import { toast } from "sonner";
// import dynamic from "next/dynamic";
import { graphql } from "gql.tada";
import { useInView } from "react-intersection-observer";
import { useCallback, useEffect, useState } from "react";

import client from "@/lib/gql/client";
import { formatError } from "@/lib/utils";
import { Skeleton } from "@umamin/ui/components/skeleton";
import type { ReceivedMessagesResult } from "../../queries";
import { ReceivedMessageCard, receivedMessageFragment } from "./card";

// const AdContainer = dynamic(() => import("@umamin/ui/ad"), {
//   ssr: false,
// });

const MESSAGES_FROM_CURSOR_QUERY = graphql(
  `
    query ReceivedMessagesFromCursor($input: MessagesFromCursorInput!) {
      messagesFromCursor(input: $input) {
        __typename
        data {
          __typename
          id
          createdAt
          ...MessageFragment
        }
        hasMore
        cursor {
          __typename
          id
          createdAt
        }
      }
    }
  `,
  [receivedMessageFragment]
);

const messagesFromCursorPersisted = graphql.persisted(
  "10ae521c718fee919520bf95d2cdc74ee1bd0d862d468ca4948ad705bb1e2909",
  MESSAGES_FROM_CURSOR_QUERY
);

type Cursor = {
  id: string | null;
  createdAt: number | null;
};

export type Props = {
  messages: ReceivedMessagesResult;
  initialCursor: Cursor;
};

export function ReceivedMessagesList({ messages, initialCursor }: Props) {
  const { ref, inView } = useInView();
  const [cursor, setCursor] = useState(initialCursor);
  const [msgs, setMsgs] = useState([] as ReceivedMessagesResult);

  const [hasMore, setHasMore] = useState(messages?.length === 10);
  const [isFetching, setIsFetching] = useState(false);

  const loadMessages = useCallback(async () => {
    if (hasMore) {
      setIsFetching(true);

      const res = await client.query(messagesFromCursorPersisted, {
        input: {
          type: "received",
          cursor,
        },
      });

      if (res.error) {
        toast.error(formatError(res.error.message));
        return;
      }

      const _res = res.data?.messagesFromCursor;

      if (_res?.cursor) {
        setCursor({
          id: _res.cursor.id,
          createdAt: _res.cursor.createdAt,
        });

        setHasMore(_res.hasMore);
      }

      if (_res?.data) {
        setMsgs((prev) => [...prev, ...(_res.data ?? [])]);
      }

      setIsFetching(false);
    }
  }, [cursor, hasMore, msgs]);

  useEffect(() => {
    if (inView && !isFetching) {
      loadMessages();
    }
  }, [inView]);

  return (
    <section className="grid xl:grid-cols-3 md:grid-cols-2 grid-cols-1 gap-3">
      {messages?.map((msg) => (
        <div key={msg.id}>
          <ReceivedMessageCard data={msg} />

          {/* v2-received-list 
          {(i + 1) % 5 === 0 && (
            <AdContainer className="mt-5" slotId="1546692714" />
          )} */}
        </div>
      ))}

      {msgs?.map((msg) => (
        <div key={msg.id}>
          <ReceivedMessageCard data={msg} />
        </div>
      ))}

      {isFetching && (
        <div className="container">
          <Skeleton className="w-full h-[200px] rounded-lg" />
        </div>
      )}
      {hasMore && <div ref={ref}></div>}
    </section>
  );
}
