"use client";

import { toast } from "sonner";
import { useEffect, useState } from "react";
import { ResultOf, graphql } from "gql.tada";
import { useInView } from "react-intersection-observer";

import { getClient } from "@/lib/gql";
import { Skeleton } from "@umamin/ui/components/skeleton";
import { sentMessageFragment, SentMessageCard } from "./card";

const MESSAGES_FROM_CURSOR_MUTATION = graphql(
  `
    mutation MessagesFromCursor($input: MessagesFromCursorInput!) {
      messagesFromCursor(input: $input) {
        __typename
        data {
          __typename
          id
          createdAt
          ...SentMessageFragment
        }
        cursor {
          __typename
          id
          hasMore
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
  messages: ResultOf<
    typeof MESSAGES_FROM_CURSOR_MUTATION
  >["messagesFromCursor"]["data"];
}) {
  const { ref, inView } = useInView();

  const [cursor, setCursor] = useState({
    id: messages[messages.length - 1].id,
    createdAt: messages[messages.length - 1].createdAt,
  });

  const [msgList, setMsgList] = useState<typeof messages>([]);
  const [hasMore, setHasMore] = useState(messages?.length === 5);
  const [isFetching, setIsFetching] = useState(false);

  function loadMessages() {
    if (hasMore) {
      setIsFetching(true);

      getClient()
        .mutation(MESSAGES_FROM_CURSOR_MUTATION, {
          input: {
            type: "sent",
            cursor,
          },
        })
        .then((res) => {
          if (res.error) {
            toast.error(res.error.message);
            setIsFetching(false);
            return;
          }

          const _cursor = res.data?.messagesFromCursor.cursor;

          if (_cursor) {
            setCursor({
              id: _cursor?.id,
              createdAt: _cursor?.createdAt,
            });

            setHasMore(_cursor?.hasMore);
          }

          if (res.data) {
            setMsgList([...msgList, ...res.data.messagesFromCursor.data]);
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
      {msgList?.map((msg) => <SentMessageCard key={msg.id} data={msg} />)}
      {isFetching && <Skeleton className="w-full h-[300px] rounded-lg" />}

      {hasMore && <div ref={ref}></div>}
    </>
  );
}
