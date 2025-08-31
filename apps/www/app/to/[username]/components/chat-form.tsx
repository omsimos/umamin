"use client";

import { toast } from "sonner";
import { useState } from "react";
import { SendIcon, Loader2Icon } from "lucide-react";

import { formatContent } from "@/lib/utils";
import { cn } from "@umamin/ui/lib/utils";
import { Button } from "@umamin/ui/components/button";
import { ChatList } from "@/components/chat-list";
import { Textarea } from "@umamin/ui/components/textarea";
import { SelectUser } from "@umamin/db/schema/user";
import { sendMessageAction } from "@/app/actions/message";
import { useDynamicTextarea } from "@/hooks/use-dynamic-textarea";
import { useMutation } from "@tanstack/react-query";

export function ChatForm({ user }: { user: SelectUser }) {
  const [content, setContent] = useState("");
  const [message, setMessage] = useState("");

  const inputRef = useDynamicTextarea(content);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await sendMessageAction({
        receiverId: user?.id,
        question: user?.question,
        content,
      });

      if (res.error) {
        throw new Error(res.error);
      }
    },
    onSuccess: () => {
      setMessage(formatContent(content));
      toast.success("Message sent anonymously");
      setContent("");
    },
    onError: (err) => {
      console.log(err);
      toast.error(err.message);
    },
  });

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
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="px-5 sm:px-7 flex items-center space-x-2 w-full self-center pt-2 max-w-lg"
        >
          <Textarea
            id="message"
            required
            ref={inputRef}
            value={content}
            disabled={mutation.isPending}
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
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
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
