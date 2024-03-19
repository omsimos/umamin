"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { ChatList } from "./chat-list";

import { Input } from "@umamin/ui/components/input";
import { Button } from "@umamin/ui/components/button";
import { ProfileHoverCard } from "./profile-hover-card";
import { Card, CardFooter, CardHeader } from "@umamin/ui/components/card";

export function ChatBox() {
  const [input, setInput] = useState("");

  const _recipient = {
    name: "John Doe",
    slug: "johndoe",
    id: "123",
    createdAt: "2021-08-01",
  };

  const _messages = [
    {
      role: "recipient",
      content:
        "The quick brown fox jumps over the lazy dog near the bank of the river?",
    },
    {
      role: "user",
      content: "Near the bank of the river, the fox really did it!!",
    },
  ];

  const handleSubmit = () => {
    return null;
  };

  return (
    <Card className="flex flex-col  justify-between w-full max-w-2xl h-[70vh] min-h-[350px] max-h-[450px] relative">
      <CardHeader className="bg-background border-b w-full item-center rounded-t-2xl flex justify-between flex-row">
        <div className="flex items-center space-x-2">
          <span className="text-muted-foreground">To:</span>
          <ProfileHoverCard user={_recipient} sessionId="456">
            <div>
              <p className="font-medium leading-none cursor-pointer">
                @johndoe
              </p>
            </div>
          </ProfileHoverCard>
        </div>
      </CardHeader>

      <ChatList messages={_messages} />

      <CardFooter className="flex w-full flex-col z-10">
        <form
          onSubmit={handleSubmit}
          className="flex w-full max-w-lg items-center space-x-2"
        >
          <Input
            id="message"
            placeholder="Type your message..."
            className="flex-1 text-base"
            autoComplete="off"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <Button
            type="submit"
            size="icon"
            disabled={input.trim().length === 0}
          >
            <Send className="h-4 w-4" />
            <span className="sr-only">Send</span>
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
