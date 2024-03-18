"use client";

import * as React from "react";
import { Send } from "lucide-react";

import { Input } from "@umamin/ui/components/input";
import { Button } from "@umamin/ui/components/button";

import { Card, CardFooter, CardHeader } from "@umamin/ui/components/card";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@umamin/ui/components/tooltip";

import { ChatList } from "./chat-list";
import { useState } from "react";

export function ChatBox() {
  const [input, setInput] = useState("");

  const messages = [
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

  const inputLength = input.trim().length;

  return (
    <Card className="flex flex-col  justify-between w-full max-w-2xl h-[70vh] min-h-[350px] max-h-[450px] relative">
      <CardHeader className="bg-background border-b w-full item-center rounded-t-2xl flex justify-between flex-row">
        <div className="flex items-center space-x-2">
          <span className="text-muted-foreground">To:</span>
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <p className="font-medium leading-none">@johndoe</p>
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs" sideOffset={25}>
                ⚡ We can add the user status here! 😲
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>

      <ChatList messages={messages} />

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
          <Button type="submit" size="icon" disabled={inputLength === 0}>
            <Send className="h-4 w-4" />
            <span className="sr-only">Send</span>
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
