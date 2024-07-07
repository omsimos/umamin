"use client";

import { toast } from "sonner";
import dynamic from "next/dynamic";
import { graphql } from "gql.tada";
import { useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";

import { client } from "@/lib/gql/client";
import { ReceivedMessagesResult } from "../../queries";
import { Skeleton } from "@umamin/ui/components/skeleton";
import { ReceivedMessageCard, receivedMessageFragment } from "./card";

const AdContainer = dynamic(() => import("@umamin/ui/ad"), { ssr: false });

const MESSAGES_FROM_CURSOR_QUERY = graphql(
  `
    query MessagesFromCursor($input: MessagesFromCursorInput!) {
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
  [receivedMessageFragment],
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

  const [msgList, setMsgList] = useState(messages);
  const [hasMore, setHasMore] = useState(messages?.length === 10);
  const [isFetching, setIsFetching] = useState(false);

  function loadMessages() {
    if (hasMore) {
      setIsFetching(true);

      client
        .query(MESSAGES_FROM_CURSOR_QUERY, {
          input: {
            type: "received",
            cursor,
          },
        })
        .toPromise()
        .then((res) => {
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
            setMsgList([...msgList, ..._res.data]);
          }

          setIsFetching(false);
        });
    }
  }

  useEffect(() => {
    if (inView && !isFetching) {
      loadMessages();
    }
  }, [inView]);

  return (
    <>
      {msgList?.map((msg, i) => (
        <div key={msg.id} className="w-full">
          <ReceivedMessageCard data={msg} />

          {/* v2-received-list */}
          {(i + 1) % 5 === 0 && (
            <AdContainer className="mt-5" slotId="1546692714" />
          )}
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
