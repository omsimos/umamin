import { toast } from "sonner";
import { nanoid } from "nanoid";
import { graphql } from "gql.tada";
import { Loader2 } from "lucide-react";
import { useMutation, useQuery } from "@urql/next";
import { Suspense, useMemo, useState } from "react";
import { Skeleton } from "@umamin/ui/components/skeleton";
import {
  ReceivedMessageCard,
  recentMessageFragment,
} from "./recent-message-card";
import { Button } from "@ui/components/ui/button";

export function RecentMessages({ userId }: { userId: string }) {
  const ids = useMemo(() => Array.from({ length: 3 }).map(() => nanoid()), []);

  return (
    <Suspense
      fallback={
        <div className="space-y-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={ids[i]} className="w-full h-[200px] rounded-lg" />
          ))}
        </div>
      }
    >
      <Recent userId={userId} />
    </Suspense>
  );
}

const recentMessagesQuery = graphql(
  `
    query RecentMessages($userId: String!, $type: String!) {
      messages(userId: $userId, type: $type) {
        __typename
        id
        createdAt
        ...MessageFragment
      }
    }
  `,
  [recentMessageFragment],
);

const messagesFromCursorMutation = graphql(
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
        cursor {
          __typename
          id
          hasMore
          createdAt
        }
      }
    }
  `,
  [recentMessageFragment],
);

function Recent({ userId }: { userId: string }) {
  const [result] = useQuery({
    query: recentMessagesQuery,
    variables: { userId, type: "recent" },
  });

  const [res, loadMore] = useMutation(messagesFromCursorMutation);

  const messages = result.data?.messages;
  const [msgList, setMsgList] = useState(messages);

  return (
    <div className="flex flex-col items-center gap-5 pb-20">
      {!msgList?.length && (
        <p className="text-sm text-muted-foreground mt-4">
          No messages to show
        </p>
      )}

      {msgList?.map((msg) => <ReceivedMessageCard key={msg.id} data={msg} />)}

      <Button
        onClick={async () => {
          if (msgList && msgList.length >= 5) {
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

              if (res.data && res.data.messagesFromCursor.cursor.hasMore) {
                setMsgList([...msgList, ...res.data.messagesFromCursor.data]);
              }
            });
          }
        }}
        className="mt-8 mx-auto"
      >
        {res.fetching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Load More
      </Button>
    </div>
  );
}
