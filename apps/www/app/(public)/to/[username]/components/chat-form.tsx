"use client";

import { useMutation } from "@tanstack/react-query";
import { Badge } from "@umamin/ui/components/badge";
import { Button } from "@umamin/ui/components/button";
import { Textarea } from "@umamin/ui/components/textarea";
import { cn } from "@umamin/ui/lib/utils";
import { Loader2Icon, MoonIcon, SendIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { sendMessageAction } from "@/app/actions/message";
import { ChatList } from "@/components/chat-list";
import UnauthenticatedDialog from "@/components/unauthenticated-dialog";
import { useDynamicTextarea } from "@/hooks/use-dynamic-textarea";
import { useSingleFlightAction } from "@/hooks/use-single-flight-action";
import { fetchCurrentUserOptional } from "@/lib/query-fetchers";
import { formatContent } from "@/lib/utils";
import type { PublicUser } from "@/types/user";

export function ChatForm({ user }: { user: PublicUser }) {
  const [content, setContent] = useState("");
  const [message, setMessage] = useState("");
  const [showUnauthenticatedDialog, setShowUnauthenticatedDialog] =
    useState(false);

  const inputRef = useDynamicTextarea(content);
  const sendMessage = useSingleFlightAction(sendMessageAction);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await sendMessage({
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
      toast.success("Message sent.");
      setContent("");
    },
    onError: (err) => {
      console.log(err);
      toast.error(err.message ?? "Couldn't send message.");
    },
  });

  const submitMessage = async () => {
    try {
      const currentUser = await fetchCurrentUserOptional();

      if (!currentUser.user) {
        setShowUnauthenticatedDialog(true);
        return;
      }

      mutation.mutate();
    } catch (error) {
      console.log(error);
      toast.error("Couldn't verify your session.");
    }
  };

  return (
    <>
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
          <Badge
            variant="secondary"
            className="text-muted-foreground text-center text-sm mx-auto"
          >
            <MoonIcon className="size-4" /> User has enabled quiet mode
          </Badge>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await submitMessage();
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
              placeholder="Type your anonymous message..."
              className="focus-visible:ring-transparent text-base resize-none min-h-10 max-h-20"
              autoComplete="off"
            />
            <Button type="submit" size="icon" disabled={mutation.isPending}>
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

      <UnauthenticatedDialog
        open={showUnauthenticatedDialog}
        onOpenChange={setShowUnauthenticatedDialog}
        isPending={mutation.isPending}
        onConfirm={() => {
          setShowUnauthenticatedDialog(false);
          mutation.mutate();
        }}
      />
    </>
  );
}
