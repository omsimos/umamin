import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@umamin/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@umamin/ui/components/dialog";
import { Textarea } from "@umamin/ui/components/textarea";
import { formatDistanceToNow } from "date-fns";
import { Loader2Icon, SendIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { createReplyAction } from "@/app/actions/message";
import { ChatList } from "@/components/chat-list";
import { useDynamicTextarea } from "@/hooks/use-dynamic-textarea";
import { useSingleFlightAction } from "@/hooks/use-single-flight-action";
import { queryKeys } from "@/lib/query";
import { patchMessage } from "@/lib/query-cache";
import type { MessagesResponse } from "@/lib/query-types";
import type { ReceivedMenuProps } from "./received-card-menu";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ReceivedMenuProps;
};

export function ReplyDialog(props: Props) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [updatedAt, setUpdatedAt] = useState(props.data.updatedAt);
  const [reply, setReply] = useState(props.data.reply ?? "");
  const inputRef = useDynamicTextarea(content);
  const submitReply = useSingleFlightAction(createReplyAction);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await submitReply({
        messageId: props.data.id,
        content,
      });

      if (res.error) {
        throw new Error(res.error);
      }

      return res;
    },
    onSuccess: (result) => {
      queryClient.setQueryData<
        import("@tanstack/react-query").InfiniteData<MessagesResponse>
      >(queryKeys.receivedMessages(), (current) =>
        patchMessage(current, props.data.id, (message) => ({
          ...message,
          reply: ("reply" in result ? result.reply : undefined) ?? content,
          updatedAt:
            ("updatedAt" in result ? result.updatedAt : undefined) ??
            new Date(),
        })),
      );
      toast.success("Reply sent.");
      setReply(content);
      setContent("");
      setUpdatedAt(new Date());
    },
    onError: (err) => {
      console.error(err);
      toast.error("Couldn't send reply.");
    },
  });

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="p-0 sm:max-w-xl">
        <DialogTitle className="sr-only">Reply to message</DialogTitle>
        <DialogDescription className="sr-only">
          Reply to this anonymous message, up to 500 characters.
        </DialogDescription>

        {/* In-flow column (not a fixed footer): the soft keyboard would push a
            position:fixed input around and cover it. */}
        <div className="flex flex-col gap-6 px-5 py-6 sm:px-7">
          <div className="max-h-[50dvh] overflow-y-auto">
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
            <form
              onSubmit={(e) => {
                e.preventDefault();
                mutation.mutate();
              }}
              className="flex items-center gap-2"
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
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
