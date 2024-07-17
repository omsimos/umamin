import { useMemo } from "react";
import { formatDistanceToNow, fromUnixTime } from "date-fns";
import { FragmentOf, graphql, readFragment } from "gql.tada";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@umamin/ui/components/card";
import { cn } from "@umamin/ui/lib/utils";
import { ReceivedMessageMenu } from "./menu";
import { useMessageStore } from "@/store/useMessageStore";

export const receivedMessageFragment = graphql(`
  fragment MessageFragment on Message {
    id
    question
    content
    reply
    createdAt
    updatedAt
  }
`);

export function ReceivedMessageCard({
  data,
}: {
  data: FragmentOf<typeof receivedMessageFragment>;
}) {
  const msg = readFragment(receivedMessageFragment, data);
  const deletedMessages = useMessageStore((state) => state.deletedList);

  const isDeleted = useMemo(
    () => deletedMessages.includes(msg.id),
    [deletedMessages, msg.id]
  );

  return (
    <div id={`umamin-${msg.id}`} className="container">
      <Card
        className={cn("min-w-2 w-full group relative", {
          "opacity-50": isDeleted,
        })}
      >
        {!isDeleted && (
          <div className="absolute top-4 right-4 text-muted-foreground">
            <ReceivedMessageMenu
              {...msg}
              reply={msg.reply}
              updatedAt={msg.updatedAt}
            />
          </div>
        )}
        <CardHeader className="flex px-12">
          <p className="font-bold text-center leading-normal text-lg min-w-0 break-words">
            {msg.question}
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex w-full flex-col gap-2 rounded-lg p-5 whitespace-pre-wrap bg-muted break-words min-w-0">
            {msg.content}
          </div>
        </CardContent>
        <CardFooter className="flex justify-center">
          <span className="text-muted-foreground text-sm mt-1 italic w-full text-center">
            {formatDistanceToNow(fromUnixTime(msg.createdAt), {
              addSuffix: true,
            })}
          </span>
        </CardFooter>
      </Card>
    </div>
  );
}
