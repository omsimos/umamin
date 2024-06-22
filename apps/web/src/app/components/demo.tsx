"use client";

import { toast } from "sonner";
import { useState } from "react";
import { graphql } from "gql.tada";
import { cn } from "@umamin/ui/lib/utils";
import { logEvent } from "firebase/analytics";
import { BadgeCheck, Loader2, Send, Lock } from "lucide-react";

import { ChatList } from "./chat-list";
import { client } from "@/lib/gql/client";
import { formatError } from "@/lib/utils";
import { analytics } from "@/lib/firebase";
import { Input } from "@umamin/ui/components/input";
import { Button } from "@umamin/ui/components/button";
import GridPattern from "@umamin/ui/components/grid-pattern";
import ShineBorder from "@umamin/ui/components/shine-border";
import { Card, CardHeader } from "@umamin/ui/components/card";

const ENCRYPT_MESSAGE_DEMO_MUTATION = graphql(`
  mutation EncryptMessageDemo($content: String!) {
    encryptMessageDemo(content: $content)
  }
`);

export function Demo() {
  const [content, setContent] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const onEncrypt: React.FormEventHandler = async (e) => {
    e.preventDefault();

    setLoading(true);

    const res = await client.mutation(ENCRYPT_MESSAGE_DEMO_MUTATION, {
      content,
    });

    if (res.error) {
      toast.error(formatError(res.error.message));
      setLoading(false);
      return;
    }

    if (res.data?.encryptMessageDemo) {
      setMessage(res.data?.encryptMessageDemo);
      setContent("");
    }

    setLoading(false);
    logEvent(analytics, "send_message_demo");
  };

  return (
    <div className="relative w-full grid place-items-center py-10">
      <GridPattern
        className={cn(
          "xl:[mask-image:radial-gradient(circle_at_center,white,transparent_60%)] [mask-image:radial-gradient(circle_at_center,white,transparent)] md:[mask-image:radial-gradient(circle_at_center,white,transparent_80%)] ",
          "border dark:border-foreground/10 border-foreground/20 z-[-1]"
        )}
      />

      <Card className="border flex flex-col w-full max-w-xl">
        <ShineBorder color="#641048">
          <CardHeader className="bg-background border-b w-full item-center rounded-t-2xl flex justify-between flex-row">
            <div className="flex items-center space-x-1">
              <span className="text-muted-foreground">To:</span>
              <p className="font-semibold text-sm">Umamin Official</p>
              <BadgeCheck className="w-4 h-4 text-pink-500" />
            </div>

            <span className="font-semibold text-muted-foreground pb-2">
              umamin
            </span>
          </CardHeader>

          <div className="flex flex-col justify-between px-5 sm:px-7 pt-10 pb-8 min-h-[350px] h-full">
            <ChatList
              imageUrl="https://lh3.googleusercontent.com/a/ACg8ocK4CtuGuDZlPy9H_DMb3EQIue9Hrd5bqYcMZOY-Xb8LcuyqsBI=s96-c"
              question="Send me an anonymous message!"
              reply={message}
            />

            <form
              onSubmit={onEncrypt}
              className="flex max-w-lg space-x-2 w-full self-center mt-12"
            >
              <Input
                required
                value={content}
                disabled={loading}
                onChange={(e) => setContent(e.target.value)}
                maxLength={150}
                placeholder="Type your message..."
                className="focus-visible:ring-transparent h-full flex-1 text-base"
                autoComplete="off"
              />
              <Button type="submit" size="icon">
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          </div>
        </ShineBorder>
      </Card>
      <div className="mt-4 text-muted-foreground text-sm flex items-center">
        <Lock className="h-4 w-4 mr-2" />
        Messages are automatically encrypted
        <Lock className="h-4 w-4 ml-2" />
      </div>
    </div>
  );
}
