import Link from "next/link";
import { CircleUser } from "lucide-react";
import { formatDistanceToNow, fromUnixTime } from "date-fns";
import { FragmentOf, readFragment, graphql } from "gql.tada";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@umamin/ui/components/card";
import { ChatList } from "@/app/components/chat-list";

export const sentMessageFragment = graphql(`
  fragment SentMessageFragment on Message {
    question
    content
    reply
    createdAt
    receiver {
      id
      imageUrl
      username
    }
  }
`);

export function SentMessageCard({
  data,
}: {
  data: FragmentOf<typeof sentMessageFragment>;
}) {
  // const menuItems = [
  //   {
  //     title: "View",
  //     onClick: () => {
  //       toast.error("Not implemented yet");
  //     },
  //   },
  //   {
  //     title: "Download",
  //     onClick: () => {
  //       toast.error("Not implemented yet");
  //     },
  //   },
  //   {
  //     title: "Delete",
  //     onClick: () => {
  //       toast.error("Not implemented yet");
  //     },
  //     className: "text-red-500",
  //   },
  // ];
  //

  const msg = readFragment(sentMessageFragment, data);

  return (
    <div className="container">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center text-muted-foreground">
            <div className="flex items-center space-x-2">
              <CircleUser className="h-4 w-4" />
              <Link
                href={`/user/${msg.receiver?.username}`}
                className="text-sm text-muted-foreground hover:underline"
              >
                {msg.receiver?.username}
              </Link>
            </div>

            <span className="font-semibold">umamin</span>
            {/* <Menu menuItems={menuItems} /> */}
          </div>
        </CardHeader>
        <CardContent className="px-5 sm:px-7">
          <ChatList
            imageUrl={msg.receiver?.imageUrl}
            question={msg.question}
            reply={msg.content}
            response={msg.reply ?? ""}
          />
        </CardContent>
        <CardFooter className="flex justify-center">
          <div className="text-muted-foreground text-sm mt-1 flex gap-1">
            <p className="italic">
              {formatDistanceToNow(fromUnixTime(msg.createdAt), {
                addSuffix: true,
              })}
            </p>

            {/* <ProfileHoverCard user={_recipient}>
                <p className="cursor-pointer hover:underline italic">
                  @johndoe
                </p> 
              </ProfileHoverCard>
          */}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
