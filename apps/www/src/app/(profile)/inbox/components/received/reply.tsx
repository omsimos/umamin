import { toast } from "sonner";
import { graphql } from "gql.tada";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { logEvent } from "firebase/analytics";
import { FormEventHandler, useState } from "react";
import { formatDistanceToNow, fromUnixTime } from "date-fns";

import client from "@/lib/gql/client";
import { cn } from "@umamin/ui/lib/utils";
import { formatError } from "@/lib/utils";
import { analytics } from "@/lib/firebase";

import type { ReceivedMenuProps } from "./menu";
import { Button } from "@umamin/ui/components/button";
import { ChatList } from "@/app/components/chat-list";
import { Textarea } from "@umamin/ui/components/textarea";
import { useDynamicTextarea } from "@/hooks/use-dynamic-textarea";
import { Dialog, DialogContent } from "@umamin/ui/components/dialog";

type Props = {
  open: boolean;
  // eslint-disable-next-line no-unused-vars
  onOpenChange: (open: boolean) => void;
  data: ReceivedMenuProps;
};

const CREATE_REPLY_MUTATION = graphql(`
  mutation CreateReply($messageId: String!, $content: String!) {
    createReply(messageId: $messageId, content: $content)
  }
`);

export function ReplyDialog(props: Props) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState(props.data.reply ?? "");
  const [updatedAt, setUpdatedAt] = useState(props.data.updatedAt);
  const inputRef = useDynamicTextarea(content);

  const onReply: FormEventHandler = async (e) => {
    e.preventDefault();
    setLoading(true);

    const res = await client.mutation(CREATE_REPLY_MUTATION, {
      messageId: props.data.id,
      content,
    });

    if (res.error) {
      toast.error(formatError(res.error.message));
      setLoading(false);
      return;
    }

    toast.success("Reply sent");
    setReply(content);
    setUpdatedAt(Date.now() / 1000);
    setContent("");
    setLoading(false);
    router.refresh();

    logEvent(analytics, "add_reply");
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-xl p-0">
        <div
          className={cn(
            "h-full max-h-[500px] overflow-scroll px-5 sm:px-7 py-10",
            !reply ? "pb-28" : ""
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
              {formatDistanceToNow(fromUnixTime(updatedAt), {
                addSuffix: true,
              })}
            </div>
          )}
        </div>

        {!reply && (
          <div className="fixed px-5 sm:px-7 bottom-0 left-1/2 -translate-x-1/2 w-full pb-4 rounded-b-lg bg-background pt-3 max-w-xl">
            <form
              onSubmit={onReply}
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
              <Button type="submit" size="icon">
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
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
