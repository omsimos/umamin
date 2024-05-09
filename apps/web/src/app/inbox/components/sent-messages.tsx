import { nanoid } from "nanoid";
import { graphql } from "gql.tada";
import { useMutation, useQuery } from "@urql/next";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Skeleton } from "@umamin/ui/components/skeleton";
import { SentMessagesCard, sentMessageFragment } from "./sent-messages-card";
import { useInView } from "react-intersection-observer";
import { toast } from "sonner";

export function SentMessages({ userId }: { userId: string }) {
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
      <Sent userId={userId} />
    </Suspense>
  );
}

const SENT_MESSAGES_QUERY = graphql(
  `
    query Messages($userId: String!, $type: String!) {
      messages(userId: $userId, type: $type) {
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

function Sent({ userId }: { userId: string }) {
  const { ref, inView } = useInView();

  const [result] = useQuery({
    query: SENT_MESSAGES_QUERY,
    variables: { userId, type: "sent" },
  });

  const [res, loadMore] = useMutation(MESSAGES_FROM_CURSOR_MUTATION);

  const messages = result.data?.messages;
  const [msgList, setMsgList] = useState(messages);

  const hasMore =
    msgList?.length === 5 || res.data?.messagesFromCursor.cursor.hasMore;

  useEffect(() => {
    if (hasMore && msgList && inView) {
      loadMore({
        input: {
          userId,
          type: "recent",
          cursor: {
            id: msgList[msgList.length - 1]?.id,
            createdAt: msgList[msgList.length - 1]?.createdAt,
          },
        },
      }).then((res) => {
        if (res.error) {
          toast.error(res.error.message);
          return;
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
