"use client";

import { toast } from "sonner";
import { useState } from "react";
import { graphql } from "gql.tada";
import { Send, ScanFace } from "lucide-react";

import { cn } from "@ui/lib/utils";
import { getClient } from "@/lib/gql";
import { Input } from "@ui/components/ui/input";
import { Button } from "@ui/components/ui/button";

import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@umamin/ui/components/avatar";

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
  imageUrl: string;
  question: string;
};

export function ChatForm({ userId, sessionId, imageUrl, question }: Props) {
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
    <div className="flex flex-col justify-between px-5 sm:px-7 pt-10 pb-8 min-h-[350px] h-full">
      <div className="flex flex-col">
        <div className="flex gap-2 items-center">
          <Avatar>
            <AvatarImage className="rounded-full" src={imageUrl} />
            <AvatarFallback>
              <ScanFace />
            </AvatarFallback>
          </Avatar>
          <div className="max-w-[75%] sm:max-w-[55%] rounded-lg px-3 py-2 whitespace-pre-wrap bg-muted">
            {question}
          </div>
        </div>

        {message && (
          <div
            className={cn(
              "max-w-[75%] sm:max-w-[55%] rounded-lg px-3 py-2 whitespace-pre-wrap bg-primary text-primary-foreground mt-6 mb-12 self-end",
            )}
          >
            {message}
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex max-w-lg items-center space-x-2 w-full self-center"
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
    </div>
  );
}
