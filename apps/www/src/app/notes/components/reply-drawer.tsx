import { toast } from "sonner";
import { useState } from "react";
import { graphql } from "gql.tada";
import { Loader2, Send } from "lucide-react";
import { logEvent } from "firebase/analytics";

import { cn } from "@umamin/ui/lib/utils";
import { analytics } from "@/lib/firebase";
import { NotesQueryResult } from "../queries";

import client from "@/lib/gql/client";
import { formatError } from "@/lib/utils";
import { Button } from "@umamin/ui/components/button";
import { ChatList } from "@/app/components/chat-list";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Textarea } from "@umamin/ui/components/textarea";
import { useDynamicTextarea } from "@/hooks/use-dynamic-textarea";
import { Drawer, DrawerContent } from "@umamin/ui/components/drawer";
import { Dialog, DialogContent } from "@umamin/ui/components/dialog";

type ChatFormProps = {
  note: NotesQueryResult[0];
  currentUserId?: string;
  // eslint-disable-next-line no-unused-vars
  setOpen: (open: boolean) => void;
};

type ReplyDrawerProps = {
  open: boolean;
} & ChatFormProps;

export function ReplyDrawer({
  open,
  setOpen,
  note,
  currentUserId,
}: ReplyDrawerProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0">
          <ChatForm
            setOpen={setOpen}
            note={note}
            currentUserId={currentUserId}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerContent className="grid place-items-center">
        <ChatForm setOpen={setOpen} note={note} currentUserId={currentUserId} />
      </DrawerContent>
    </Drawer>
  );
}

const CREATE_MESSAGE_MUTATION = graphql(`
  mutation CreateMessageFromNote($input: CreateMessageInput!) {
    createMessage(input: $input) {
      __typename
    }
  }
`);

const createMessagePersisted = graphql.persisted(
  "53f885d2afe8feedba14ca10ddf0bda7d6a1dd79dd21eefd5ea792074848ee60",
  CREATE_MESSAGE_MUTATION
);

const ChatForm = ({ note, currentUserId, setOpen }: ChatFormProps) => {
  const [content, setContent] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const inputRef = useDynamicTextarea(content);

  const user = note.user;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!user?.id) {
      toast.error("An error occurred");
      setOpen(false);
      return;
    }

    setIsSending(true);

    try {
      const res = await client.mutation(createMessagePersisted, {
        input: {
          senderId: currentUserId,
          receiverId: user?.id,
          question: note.content ?? "",
          content,
        },
      });

      if (res.error) {
        toast.error(formatError(res.error.message));
        setIsSending(false);
        setOpen(false);
        return;
      }

      setMessage(content.replace(/(\r\n|\n|\r){2,}/g, "\n\n"));
      setIsSending(false);

      logEvent(analytics, "send_note_reply");
    } catch (err: any) {
      toast.error("An error occured");
      setIsSending(false);
      setOpen(false);
    }
  }

  return (
    <div
      className={cn(
        "max-w-xl w-full flex flex-col justify-between px-5 sm:px-7 py-10 h-full max-h-[500px] overflow-scroll rounded-lg",
        user?.quietMode ? "min-h-[250px]" : "min-h-[350px]",
        !message ? "pb-28" : ""
      )}
    >
      <ChatList
        imageUrl={user?.imageUrl}
        question={note.content ?? ""}
        reply={message}
      />
      {!message && (
        <div className="fixed px-5 sm:px-7 bottom-0 left-1/2 -translate-x-1/2 w-full pb-4 rounded-b-lg bg-background pt-3 max-w-xl">
          <form
            onSubmit={handleSubmit}
            className="flex items-center space-x-2 w-full self-center"
          >
            <Textarea
              id="message"
              required
              ref={inputRef}
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
              }}
              maxLength={500}
              placeholder="Type your anonymous reply..."
              className="focus-visible:ring-transparent text-base resize-none min-h-10 max-h-20"
              autoComplete="off"
            />
            <Button type="submit" size="icon" disabled={isSending}>
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span className="sr-only">Send</span>
            </Button>
          </form>
        </div>
      )}
    </div>
  );
};
