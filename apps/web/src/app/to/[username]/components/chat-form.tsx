"use client";

import { toast } from "sonner";
import { useState } from "react";
import { graphql } from "gql.tada";
import { Send } from "lucide-react";

import { getClient } from "@/lib/gql";
import { Input } from "@ui/components/ui/input";
import { Button } from "@ui/components/ui/button";
import { cn } from "@ui/lib/utils";

const CreateMessageMutation = graphql(`
  mutation CreateMessage($input: CreateMessageInput!) {
    createMessage(input: $input) {
      id
      content
    }
  }
`);

type Props = {
  userId: string;
  sessionId?: string;
  question: string;
};

export function ChatForm({ userId, sessionId, question }: Props) {
  const [content, setContent] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // if (userId === sessionId) {
    //   toast.error("You can't send a message to yourself");
    //   return;
    // }

    const res = await getClient().mutation(CreateMessageMutation, {
      input: {
        senderId: sessionId,
        userId,
        question,
        content,
      },
    });

    if (res.error) {
      toast.error("An error occurred");
      return;
    }

    setMessage(res.data?.createMessage.content ?? "");
    setContent("");
    toast.success("Message sent");
  }

  return (
    <section
      className={cn(
        "flex flex-col h-full",
        !!message ? "justify-between" : "justify-end",
      )}
    >
      {message && (
        <div
          className={cn(
            "flex w-max max-w-[75%] sm:max-w-[55%] flex-col gap-2 rounded-lg px-3 py-2 whitespace-pre-wrap ml-auto bg-primary text-primary-foreground",
          )}
        >
          {message}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-lg items-center space-x-2 self-center"
      >
        <Input
          id="message"
          required
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
          // disabled={input.trim().length === 0}
        >
          <Send className="h-4 w-4" />
          <span className="sr-only">Send</span>
        </Button>
      </form>
    </section>
  );
}
