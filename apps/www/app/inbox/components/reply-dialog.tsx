import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2Icon, SendIcon } from "lucide-react";
import { FormEventHandler, useState } from "react";
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";

import { useDynamicTextarea } from "@/hooks/use-dynamic-textarea";
import { ReceivedMenuProps } from "./received-card-menu";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ChatList } from "@/components/chat-list";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createReplyAction } from "@/app/actions/message";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ReceivedMenuProps;
};

export function ReplyDialog(props: Props) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState(props.data.reply ?? "");
  const [updatedAt, setUpdatedAt] = useState(props.data.updatedAt);
  const inputRef = useDynamicTextarea(content);

  const handleReply: FormEventHandler = async (e) => {
    e.preventDefault();
    setLoading(true);

    const res = await createReplyAction({
      messageId: props.data.id,
      content,
    });

    if (res.error) {
      toast.error(res.error);
      setLoading(false);
      return;
    }

    toast.success("Reply sent");
    setReply(content);
    setUpdatedAt(new Date());
    setContent("");
    setLoading(false);
    router.refresh();
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-xl p-0">
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
              onSubmit={handleReply}
              className="flex items-center space-x-2 w-full self-center"
            >
              <Textarea
                id="message"
                required
                ref={inputRef}
                disabled={loading}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                maxLength={500}
                placeholder="Type your reply..."
                className="focus-visible:ring-transparent flex-1 text-base resize-none min-h-10 max-h-20"
                autoComplete="off"
              />
              <Button
                data-testid="msg-send-reply-btn"
                type="submit"
                size="icon"
              >
                {loading ? (
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
