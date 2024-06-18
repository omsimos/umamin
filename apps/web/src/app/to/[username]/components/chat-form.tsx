"use client";

import { toast } from "sonner";
import { useState } from "react";
import { graphql } from "gql.tada";
import { analytics } from "@/lib/firebase";
import { Loader2, MessageCircleOff, Send } from "lucide-react";
import { logEvent } from "firebase/analytics";

import { formatError } from "@/lib/utils";
import { client } from "@/lib/gql/client";
import { Input } from "@umamin/ui/components/input";
import { Button } from "@umamin/ui/components/button";
import { ChatList } from "@/app/components/chat-list";
import { UserByUsernameQueryResult } from "../queries";

const CREATE_MESSAGE_MUTATION = graphql(`
  mutation CreateMessage($input: CreateMessageInput!) {
    createMessage(input: $input) {
      id
      content
    }
  }
`);

type Props = {
  currentUserId?: string;
  user: UserByUsernameQueryResult;
};

export function ChatForm({ currentUserId, user }: Props) {
  const [content, setContent] = useState("");
  const [message, setMessage] = useState("");
  const [isFetching, setIsFetching] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!user) {
      toast.error("An error occurred");
      return;
    }

    if (user?.id === currentUserId) {
      toast.error("You can't send a message to yourself");
      return;
    }

    setIsFetching(true);

    client
      .mutation(CREATE_MESSAGE_MUTATION, {
        input: {
          senderId: currentUserId,
          receiverId: user?.id,
          question: user?.question,
          content,
        },
      })
      .then((res) => {
        if (res.error) {
          toast.error(formatError(res.error.message));
          setIsFetching(false);
          return;
        }

        setMessage(res.data?.createMessage.content ?? "");
        setContent("");
        toast.success("Message sent");
        setIsFetching(false);

        logEvent(analytics, "send_message");
      });
  }

  return (
    <div className="flex flex-col justify-between px-5 sm:px-7 pt-10 pb-8 min-h-[350px] h-full">
      <ChatList
        imageUrl={user?.imageUrl}
        question={user?.question ?? ""}
        reply={message}
      />

      {user?.quietMode ? (
        <div className="text-muted-foreground text-sm flex items-center justify-center">
          <MessageCircleOff className="h-4 w-4 mr-2" />
          User has enabled quiet mode
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="flex max-w-lg items-center space-x-2 w-full self-center mt-12"
        >
          <Input
            id="message"
            required
            disabled={isFetching}
            maxLength={1000}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Type your message..."
            className="focus-visible:ring-transparent flex-1 text-base"
            autoComplete="off"
          />
          <Button
            type="submit"
            size="icon"
            disabled={isFetching}
            // disabled={input.trim().length === 0}
          >
            {isFetching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            <span className="sr-only">Send</span>
          </Button>
        </form>
      )}
    </div>
  );
}
