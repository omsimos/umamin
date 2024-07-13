"use client";

import { toast } from "sonner";
import { graphql } from "gql.tada";
import { useInView } from "react-intersection-observer";
import { useCallback, useEffect, useState } from "react";

import client from "@/lib/gql/client";
import { ReceivedMessagesResult } from "../../queries";
import { Skeleton } from "@umamin/ui/components/skeleton";
import { useMessageStore } from "@/store/useMessageStore";
import { ReceivedMessageCard, receivedMessageFragment } from "./card";

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

export function ReceivedMessagesList({
  messages,
}: {
  messages: ReceivedMessagesResult;
}) {
  const { ref, inView } = useInView();

  const [cursor, setCursor] = useState({
    id: messages[messages.length - 1]?.id ?? null,
    createdAt: messages[messages.length - 1]?.createdAt ?? null,
  });

  const msgList = useMessageStore((state) => state.receivedList);
  const updateMsgList = useMessageStore((state) => state.updateReceivedList);

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
        toast.error(res.error.message);
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
        updateMsgList(_res.data);
      }

      setIsFetching(false);
    }
  }, [cursor, hasMore, msgList]);

  useEffect(() => {
    if (inView && !isFetching) {
      loadMessages();
    }
  }, [inView]);

  return (
    <>
      {messages?.map((msg) => (
        <div key={msg.id} className="w-full">
          <ReceivedMessageCard data={msg} />

          {/* v2-received-list 
            {(i + 1) % 5 === 0 && (
                <AdContainer className="mt-5" slotId="1546692714" />
            )}
          */}
        </div>
      ))}

      {msgList?.map((msg) => (
        <div key={msg.id} className="w-full">
          <ReceivedMessageCard data={msg} />

          {/* v2-received-list 
            {(i + 1) % 5 === 0 && (
                <AdContainer className="mt-5" slotId="1546692714" />
            )}
          */}
        </div>
      ))}

      {isFetching && (
        <div className="container">
          <Skeleton className="w-full h-[200px] rounded-lg" />
        </div>
      )}
      {hasMore && <div ref={ref}></div>}
    </>
  );
}
