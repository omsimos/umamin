import { useMutation } from "@tanstack/react-query";
import { Button } from "@umamin/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@umamin/ui/components/dialog";
import { Textarea } from "@umamin/ui/components/textarea";
import { cn } from "@umamin/ui/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { Loader2Icon, SendIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { createReplyAction } from "@/app/actions/message";
import { ChatList } from "@/components/chat-list";
import { useDynamicTextarea } from "@/hooks/use-dynamic-textarea";
import type { ReceivedMenuProps } from "./received-card-menu";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ReceivedMenuProps;
};

export function ReplyDialog(props: Props) {
  const [content, setContent] = useState("");
  const [updatedAt, setUpdatedAt] = useState(props.data.updatedAt);
  const [reply, setReply] = useState(props.data.reply ?? "");
  const inputRef = useDynamicTextarea(content);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await createReplyAction({
        messageId: props.data.id,
        content,
      });

      if (res.error) {
        throw new Error(res.error);
      }
    },
    onSuccess: () => {
      toast.success("Reply sent");
      setReply(content);
      setContent("");
      setUpdatedAt(new Date());
    },
    onError: (err) => {
      console.error(err);
      toast.error("Failed to send reply. Please try again.");
    },
  });

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-xl p-0">
        <DialogTitle className="sr-only"></DialogTitle>
        <div
          className={cn(
            "h-full max-h-[500px] overflow-scroll px-5 sm:px-7 py-10",
            !reply ? "pb-28" : "",
          )}
        >
          <h3 className="font-bold text-center leading-normal text-lg min-w-0 break-words mb-10">
            {props.data.question}
          </h3>

          <ChatList
            question={props.data.content}
            reply={props.data.reply ?? reply}
          />

          {reply && updatedAt && (
            <div className="text-muted-foreground text-sm italic w-full text-center mt-10">
              replied{" "}
              {formatDistanceToNow(updatedAt, {
                addSuffix: true,
              })}
            </div>
          )}
        </div>

        {!reply && (
          <div className="fixed px-5 sm:px-7 bottom-0 left-1/2 -translate-x-1/2 w-full pb-4 rounded-b-lg bg-background pt-3 max-w-xl">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                mutation.mutate();
              }}
              className="flex items-center space-x-2 w-full self-center"
            >
              <Textarea
                id="message"
                required
                ref={inputRef}
                disabled={mutation.isPending}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                maxLength={500}
                placeholder="Type your reply..."
                className="focus-visible:ring-transparent flex-1 text-base resize-none min-h-10 max-h-20"
                autoComplete="off"
              />
              <Button type="submit" size="icon">
                {mutation.isPending ? (
                  <Loader2Icon className="w-4 h-4 animate-spin" />
                ) : (
                  <SendIcon className="h-4 w-4" />
                )}
                <span className="sr-only">Send</span>
              </Button>
            </form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
