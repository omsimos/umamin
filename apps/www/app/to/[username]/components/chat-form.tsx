"use client";

import { toast } from "sonner";
import { useState } from "react";
import { SendIcon, Loader2Icon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChatList } from "@/components/chat-list";
import { Textarea } from "@/components/ui/textarea";
import { SelectUser } from "@umamin/db/schema/user";
import { sendMessageAction } from "@/app/actions/message";
import { useDynamicTextarea } from "@/hooks/use-dynamic-textarea";

type Props = {
  currentUserId?: string;
  user: SelectUser;
};

export function ChatForm({ currentUserId, user }: Props) {
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
      const res = await sendMessageAction({
        senderId: currentUserId,
        receiverId: user?.id,
        question: user?.question,
        content,
      });

      if (res.error) {
        toast.error(res.error);
        setIsFetching(false);
        return;
      }

      setContent("");
      toast.success("Message sent anonymously");
      setMessage(content.replace(/(\r\n|\n|\r){2,}/g, "\n\n"));
      setIsFetching(false);
    } catch (err) {
      console.log(err);
      toast.error("An error occured");
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
            disabled={isFetching}
            onChange={(e) => {
              setContent(e.target.value);
            }}
            maxLength={500}
            placeholder="Type your message..."
            className="focus-visible:ring-transparent text-base resize-none min-h-10 max-h-20"
            autoComplete="off"
          />
          <Button
            data-testid="send-msg-btn"
            type="submit"
            size="icon"
            disabled={isFetching}
          >
            {isFetching ? (
              <Loader2Icon className="w-4 h-4 animate-spin" />
            ) : (
              <SendIcon className="h-4 w-4" />
            )}
            <span className="sr-only">Send</span>
          </Button>
        </form>
      )}
    </div>
   );
}
