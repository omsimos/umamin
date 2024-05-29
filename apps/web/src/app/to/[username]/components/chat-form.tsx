"use client";

import { toast } from "sonner";
import { useState } from "react";
import { graphql } from "gql.tada";
import { analytics } from "@/lib/firebase";
import { logEvent } from "firebase/analytics";
import { Loader2, Send } from "lucide-react";

import { getClient } from "@/lib/gql";
import { Input } from "@ui/components/ui/input";
import { Button } from "@ui/components/ui/button";
import { ChatList } from "@/app/components/chat-list";

const CREATE_MESSAGE_MUTATION = graphql(`
  mutation CreateMessage($input: CreateMessageInput!) {
    createMessage(input: $input) {
      id
      content
    }
  }
`);

type Props = {
  receiverId: string;
  sessionId?: string;
  imageUrl?: string | null;
  question: string;
  quietMode: boolean;
};

export function ChatForm({
  receiverId,
  sessionId,
  imageUrl,
  question,
  quietMode,
}: Props) {
  const [content, setContent] = useState("");
  const [message, setMessage] = useState("");
  const [isFetching, setIsFetching] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (receiverId === sessionId) {
      toast.error("You can't send a message to yourself");
      return;
    }

    setIsFetching(true);

    getClient()
      .mutation(CREATE_MESSAGE_MUTATION, {
        input: {
          senderId: sessionId,
          receiverId,
          question,
          content,
        },
      })
      .then((res) => {
        if (res.error) {
          toast.error("An error occurred");
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
      <ChatList imageUrl={imageUrl} question={question} reply={message} />

      {quietMode ? (
        <p className="text-muted-foreground text-center">
          User has enabled quiet mode
        </p>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="flex max-w-lg items-center space-x-2 w-full self-center"
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
