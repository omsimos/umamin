import { toast } from "sonner";
import { useState } from "react";
import { graphql } from "gql.tada";
import { Loader2, Send } from "lucide-react";
import { logEvent } from "firebase/analytics";

import { cn } from "@umamin/ui/lib/utils";
import { analytics } from "@/lib/firebase";
import { NoteQueryResult } from "../queries";

import { formatError } from "@/lib/utils";
import { client } from "@/lib/gql/client";
import { Input } from "@umamin/ui/components/input";
import { Button } from "@umamin/ui/components/button";
import { ChatList } from "@/app/components/chat-list";
import { Drawer, DrawerContent } from "@umamin/ui/components/drawer";
import { Dialog, DialogContent } from "@umamin/ui/components/dialog";
import { useMediaQuery } from "@/app/components/utilities/use-media-query";

type ChatFormProps = {
  note: Partial<Omit<NoteQueryResult, "user">>;
  user?: {
    id?: string;
    displayName?: string | null;
    username?: string;
    imageUrl?: string | null;
    quietMode?: string | null;
  };
  currentUserId?: string;
  // eslint-disable-next-line no-unused-vars
  setOpen: (open: boolean) => void;
};

type ReplyDrawerProps = {
  open: boolean;
  // eslint-disable-next-line no-unused-vars
  setOpen: (open: boolean) => void;
  currentUserId?: string;
} & ChatFormProps;

export function ReplyDrawer({
  open,
  setOpen,
  user,
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
            user={user}
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
        <ChatForm
          setOpen={setOpen}
          user={user}
          note={note}
          currentUserId={currentUserId}
        />
      </DrawerContent>
    </Drawer>
  );
}

const CREATE_MESSAGE_MUTATION = graphql(`
  mutation CreateMessage($input: CreateMessageInput!) {
    createMessage(input: $input) {
      __typename
    }
  }
`);

const ChatForm = ({ user, note, currentUserId, setOpen }: ChatFormProps) => {
  const [content, setContent] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!user?.id) {
      toast.error("An error occurred");
      setOpen(false);
      return;
    }

    setIsSending(true);

    try {
      const res = await client.mutation(CREATE_MESSAGE_MUTATION, {
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

      setMessage(content);
      setContent("");
      toast.success("Reply sent");
      setIsSending(false);
      setOpen(false);

      logEvent(analytics, "send_note_reply");
    } catch (err: any) {
      toast.error(err.message);
      setIsSending(false);
      setOpen(false);
    }
  }
  return (
    <div
      className={cn(
        "max-w-xl w-full flex flex-col justify-between px-5 sm:px-7 pt-10 h-full max-h-[500px] overflow-scroll pb-24 rounded-lg",
        user?.quietMode ? "min-h-[250px]" : "min-h-[350px]"
      )}
    >
      <ChatList
        imageUrl={user?.imageUrl}
        question={note.content ?? ""}
        anonymous={note?.isAnonymous}
        reply={message}
      />
      <div className="fixed px-5 sm:px-7 bottom-0 left-1/2 -translate-x-1/2 w-full pb-4 rounded-b-lg bg-background pt-3 max-w-xl">
        <form
          onSubmit={handleSubmit}
          className="flex items-center space-x-2 w-full self-center"
        >
          <Input
            id="message"
            required
            disabled={isSending}
            maxLength={500}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Type your message..."
            className="focus-visible:ring-transparent flex-1 text-base"
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
    </div>
  );
};
