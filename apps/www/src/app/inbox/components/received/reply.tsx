import { toast } from "sonner";
import { graphql } from "gql.tada";
import { Loader2, Send } from "lucide-react";
import { logEvent } from "firebase/analytics";
import { FormEventHandler, useState } from "react";
import { formatDistanceToNow, fromUnixTime } from "date-fns";

import { client } from "@/lib/gql/client";
import { formatError } from "@/lib/utils";
import { analytics } from "@/lib/firebase";

import type { ReceivedMenuProps } from "./menu";
import { Input } from "@umamin/ui/components/input";
import { Button } from "@umamin/ui/components/button";
import { ChatList } from "@/app/components/chat-list";
import { Dialog, DialogContent } from "@umamin/ui/components/dialog";
import { useRouter } from "next/navigation";

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

  const onReply: FormEventHandler = (e) => {
    e.preventDefault();
    setLoading(true);

    client
      .mutation(CREATE_REPLY_MUTATION, { messageId: props.data.id, content })
      .then((res) => {
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
      });
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <h3 className="font-bold text-center leading-normal text-lg min-w-0 break-words mb-6">
          {props.data.question}
        </h3>

        <ChatList
          question={props.data.content}
          reply={props.data.reply ?? reply}
        />

        {reply && updatedAt && (
          <span className="text-muted-foreground text-sm italic w-full text-center mt-6">
            replied{" "}
            {formatDistanceToNow(fromUnixTime(updatedAt), {
              addSuffix: true,
            })}
          </span>
        )}

        {!reply && (
          <form
            onSubmit={onReply}
            className="flex max-w-lg items-center space-x-2 w-full self-center mt-12"
          >
            <Input
              id="message"
              required
              disabled={loading}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={1000}
              placeholder="Type your reply..."
              className="focus-visible:ring-transparent flex-1 text-base"
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
        )}
      </DialogContent>
    </Dialog>
  );
}
