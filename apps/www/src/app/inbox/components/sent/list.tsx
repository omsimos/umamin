"use client";

import { toast } from "sonner";
import dynamic from "next/dynamic";
import { graphql } from "gql.tada";
import { useInView } from "react-intersection-observer";
import { useCallback, useEffect, useState } from "react";

import { client } from "@/lib/gql/client";
import { SentMessageResult } from "../../queries";
import { Skeleton } from "@umamin/ui/components/skeleton";
import { useMessageStore } from "@/store/useMessageStore";
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

  const msgList = useMessageStore((state) => state.sentList);
  const updateMsgList = useMessageStore((state) => state.updateSentList);

  const [hasMore, setHasMore] = useState(messages?.length === 10);
  const [isFetching, setIsFetching] = useState(false);

  const loadMessages = useCallback(async () => {
    if (hasMore) {
      setIsFetching(true);

      const res = await client.query(MESSAGES_FROM_CURSOR_QUERY, {
        input: {
          type: "sent",
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
  }, [hasMore, cursor, msgList]);

  useEffect(() => {
    if (inView && !isFetching) {
      loadMessages();
    }
  }, [inView]);

  return (
    <>
      {messages?.map((msg, i) => (
        <div key={msg.id} className="w-full">
          <SentMessageCard data={msg} />

          {/* v2-sent-list */}
          {(i + 1) % 5 === 0 && (
            <AdContainer className="mt-5" slotId="1355121027" />
          )}
        </div>
      ))}

      {msgList?.map((msg, i) => (
        <div key={msg.id} className="w-full">
          <SentMessageCard data={msg} />

          {/* v2-sent-list */}
          {(i + 1) % 5 === 0 && (
            <AdContainer className="mt-5" slotId="1355121027" />
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
