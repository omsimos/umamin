import { formatDistanceToNow } from "date-fns";
import { FragmentOf, graphql, readFragment } from "gql.tada";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@umamin/ui/components/card";
import { ReceivedMessageMenu } from "./menu";

export const receivedMessageFragment = graphql(`
  fragment MessageFragment on Message {
    id
    question
    content
    createdAt
  }
`);

export function ReceivedMessageCard({
  data,
}: {
  data: FragmentOf<typeof receivedMessageFragment>;
}) {
  const msg = readFragment(receivedMessageFragment, data);

  return (
    <div id={msg.id} className="w-full">
      <Card className="min-w-2 w-full group relative">
        <div className="absolute top-4 right-4 text-muted-foreground">
          <ReceivedMessageMenu id={msg.id} />
        </div>

        <CardHeader className="flex px-12">
          <p className="font-bold text-center leading-normal text-lg">{msg.question}</p>
        </CardHeader>
        <CardContent>
          <div className="flex w-full flex-col gap-2 rounded-lg p-5 whitespace-pre-wrap bg-muted">
            {msg.content}
          </div>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-muted-foreground text-sm mt-1 italic">
            {formatDistanceToNow(new Date(msg.createdAt), {
              addSuffix: true,
            })}
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
