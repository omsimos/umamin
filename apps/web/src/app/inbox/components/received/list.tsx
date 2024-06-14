"use client";

import { toast } from "sonner";
import { useEffect, useState } from "react";
import { graphql } from "gql.tada";
import { useInView } from "react-intersection-observer";

import { client } from "@/lib/gql/client";
import { ReceivedMessagesResult } from "../../queries";
import { Skeleton } from "@umamin/ui/components/skeleton";
import { ReceivedMessageCard, receivedMessageFragment } from "./card";

const MESSAGES_FROM_CURSOR_MUTATION = graphql(
  `
    mutation MessagesFromCursor($input: MessagesFromCursorInput!) {
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
  const [hasMore, setHasMore] = useState(messages?.length === 5);
  const [isFetching, setIsFetching] = useState(false);

  function loadMessages() {
    if (hasMore) {
      setIsFetching(true);

      client
        .mutation(MESSAGES_FROM_CURSOR_MUTATION, {
          input: {
            type: "received",
            cursor,
          },
        })
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
      {msgList?.map((msg) => <ReceivedMessageCard key={msg.id} data={msg} />)}
      {isFetching && <Skeleton className="w-full h-[200px] rounded-lg" />}

      {hasMore && <div ref={ref}></div>}
    </>
  );
}
