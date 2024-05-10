import { nanoid } from "nanoid";
import { graphql } from "gql.tada";
import { useMutation, useQuery } from "@urql/next";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Skeleton } from "@umamin/ui/components/skeleton";
import { SentMessagesCard, sentMessageFragment } from "./sent-messages-card";
import { useInView } from "react-intersection-observer";
import { toast } from "sonner";

export function SentMessages() {
  const ids = useMemo(() => Array.from({ length: 3 }).map(() => nanoid()), []);

  return (
    <Suspense
      fallback={
        <div className="space-y-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={ids[i]} className="w-full h-[300px] rounded-lg" />
          ))}
        </div>
      }
    >
      <Sent />
    </Suspense>
  );
}

const SENT_MESSAGES_QUERY = graphql(
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

function Sent() {
  const { ref, inView } = useInView();

  const [result] = useQuery({
    query: SENT_MESSAGES_QUERY,
    variables: { type: "sent" },
  });

  const [res, loadMore] = useMutation(MESSAGES_FROM_CURSOR_MUTATION);

  const messages = result.data?.messages;

  const [cursor, setCursor] = useState(
    messages && {
      id: messages[messages.length - 1].id,
      createdAt: messages[messages.length - 1].createdAt,
    },
  );

  const [msgList, setMsgList] = useState(messages);

  const hasMore =
    msgList?.length === 5 || res.data?.messagesFromCursor.cursor.hasMore;

  useEffect(() => {
    if (hasMore && msgList && inView && cursor) {
      loadMore({
        input: {
          type: "recent",
          cursor,
        },
      }).then((res) => {
        if (res.error) {
          toast.error(res.error.message);
          return;
        }

        const _cursor = res.data?.messagesFromCursor.cursor;

        if (_cursor) {
          setCursor({
            id: _cursor?.id,
            createdAt: _cursor?.createdAt,
          });
        }

        if (res.data) {
          setMsgList([...msgList, ...res.data.messagesFromCursor.data]);
        }
      });
    }
  }, [hasMore, inView, msgList]);

  return (
    <div className="flex w-full flex-col items-center gap-5 pb-20">
      {!msgList?.length && (
        <p className="text-sm text-muted-foreground mt-4">
          No messages to show
        </p>
      )}

      {msgList?.map((msg) => <SentMessagesCard key={msg.id} data={msg} />)}
      {res.fetching && <Skeleton className="w-full h-[300px] rounded-lg" />}

      {hasMore && <div ref={ref}></div>}
    </div>
  );
}
