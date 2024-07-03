"use client";

import { toast } from "sonner";
import dynamic from "next/dynamic";
import { graphql } from "gql.tada";
import { useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";

import { client } from "@/lib/gql/client";
import { SentMessageResult } from "../../queries";
import { Skeleton } from "@umamin/ui/components/skeleton";
import { sentMessageFragment, SentMessageCard } from "./card";

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
          ...SentMessageFragment
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
  [sentMessageFragment],
);

export function SentMessagesList({
  messages,
}: {
  messages: SentMessageResult;
}) {
  const { ref, inView } = useInView();

  const [cursor, setCursor] = useState({
    id: messages[messages.length - 1]?.id ?? null,
    createdAt: messages[messages.length - 1]?.createdAt ?? null,
  });

  const [msgList, setMsgList] = useState(messages);
  const [hasMore, setHasMore] = useState(messages?.length === 5);
  const [isFetching, setIsFetching] = useState(false);

  function loadMessages() {
    if (hasMore) {
      setIsFetching(true);

      client
        .query(MESSAGES_FROM_CURSOR_QUERY, {
          input: {
            type: "sent",
            cursor,
          },
        })
        .toPromise()
        .then((res) => {
          if (res.error) {
            toast.error(res.error.message);
            setIsFetching(false);
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
    if (inView) {
      loadMessages();
    }
  }, [inView]);

  return (
    <>
      {msgList?.map((msg, i) => (
        <div key={msg.id} className="w-full">
          <SentMessageCard data={msg} />

          {/* v2-sent-list */}
          {(i + 1) % 5 === 0 && (
            <AdContainer className="mt-5" slotId="1355121027" inView={inView} />
          )}
        </div>
      ))}

      {isFetching && (
        <div className="container">
          <Skeleton className="w-full h-[250px] rounded-lg" />
        </div>
      )}
      {hasMore && <div ref={ref}></div>}
    </>
  );
}
