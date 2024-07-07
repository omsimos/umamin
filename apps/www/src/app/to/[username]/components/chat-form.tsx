"use client";

import { toast } from "sonner";
import { graphql } from "gql.tada";
import { analytics } from "@/lib/firebase";
import { Loader2, Send } from "lucide-react";
import { logEvent } from "firebase/analytics";
import { useState } from "react";

import { cn } from "@umamin/ui/lib/utils";
import { formatError } from "@/lib/utils";
import { client } from "@/lib/gql/client";
import { Button } from "@umamin/ui/components/button";
import { ChatList } from "@/app/components/chat-list";
import { UserByUsernameQueryResult } from "../queries";
import { Textarea } from "@umamin/ui/components/textarea";
import useBotDetection from "@/hooks/use-bot-detection";
import { useDynamicTextarea } from "@/hooks/use-dynamic-textarea";

const CREATE_MESSAGE_MUTATION = graphql(`
  mutation CreateMessage($input: CreateMessageInput!) {
    createMessage(input: $input) {
      __typename
    }
  }
`);

type Props = {
  currentUserId?: string;
  user: UserByUsernameQueryResult;
};

export function ChatForm({ currentUserId, user }: Props) {
  useBotDetection();
  const [content, setContent] = useState("");
  const [message, setMessage] = useState("");
  const [isFetching, setIsFetching] = useState(false);

  const inputRef = useDynamicTextarea(content);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
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

    try {
      const res = await client.mutation(CREATE_MESSAGE_MUTATION, {
        input: {
          senderId: currentUserId,
          receiverId: user?.id,
          question: user?.question,
          content,
        },
      });

      if (res.error) {
        toast.error(formatError(res.error.message));
        setIsFetching(false);
        return;
      }

      setMessage(content.replace(/(\r\n|\n|\r){2,}/g, "\n\n"));
      setContent("");
      toast.success("Message sent");
      setIsFetching(false);

      logEvent(analytics, "send_message");
    } catch (err: any) {
      toast.error(err.message);
      setIsFetching(false);
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col justify-between pb-6 h-full max-h-[400px] relative w-full min-w-0",
        user?.quietMode ? "min-h-[250px]" : "min-h-[350px]",
      )}
    >
      <div className="flex flex-col h-full overflow-scroll pt-10 px-5 sm:px-7 pb-5 w-full relative min-w-0 ">
        <ChatList
          imageUrl={user?.imageUrl}
          question={user?.question ?? ""}
          reply={message}
        />
      </div>

      {user?.quietMode ? (
        <span className="text-muted-foreground text-center text-sm">
          User has enabled quiet mode
        </span>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="px-5 sm:px-7 flex items-center space-x-2 w-full self-center pt-2 max-w-lg"
        >
          <Textarea
            id="message"
            required
            ref={inputRef}
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
            }}
            maxLength={500}
            placeholder="Type your message..."
            className="focus-visible:ring-transparent text-base resize-none min-h-10 max-h-20"
            autoComplete="off"
          />
          <Button type="submit" size="icon" disabled={isFetching}>
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
