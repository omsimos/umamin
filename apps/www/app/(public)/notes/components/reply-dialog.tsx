import { useMutation } from "@tanstack/react-query";
import type { SelectNote } from "@umamin/db/schema/note";
import { Button } from "@umamin/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@umamin/ui/components/dialog";
import { Textarea } from "@umamin/ui/components/textarea";
import { Loader2Icon, SendIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { sendMessageAction } from "@/app/actions/message";
import { ChatList } from "@/components/chat-list";
import { useDynamicTextarea } from "@/hooks/use-dynamic-textarea";
import { formatContent } from "@/lib/utils";
import type { FeedAuthorWithBadge } from "@/types/user";

type ChatFormProps = {
  note: SelectNote & { user: FeedAuthorWithBadge };
};

type ReplyDialogProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
} & ChatFormProps;

// A centered Dialog (not a bottom Drawer): the soft keyboard pushes a bottom
// sheet around and breaks its layout. The Dialog stays put and the browser
// scrolls the focused input into view.
export function ReplyDialog({ isOpen, setIsOpen, note }: ReplyDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="p-0">
        <DialogTitle className="sr-only">Reply to note</DialogTitle>
        <DialogDescription className="sr-only">
          Send an anonymous reply to this note, up to 500 characters.
        </DialogDescription>
        <ChatForm note={note} />
      </DialogContent>
    </Dialog>
  );
}

const ChatForm = ({ note }: ChatFormProps) => {
  const [content, setContent] = useState("");
  const [message, setMessage] = useState("");
  const inputRef = useDynamicTextarea(content);

  const user = note.user;

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await sendMessageAction({
        receiverId: user?.id,
        question: note.content ?? "",
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

  return (
    <div className="flex flex-col gap-4 px-5 py-6 sm:px-6">
      <div className="max-h-[50dvh] overflow-y-auto">
        <ChatList
          imageUrl={user?.imageUrl}
          question={note.content ?? ""}
          reply={message}
        />
      </div>

      {!message && (
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
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
            }}
            maxLength={500}
            placeholder="Type your anonymous reply..."
            className="max-h-20 min-h-10 resize-none text-base focus-visible:ring-transparent"
            autoComplete="off"
          />
          <Button type="submit" size="icon" disabled={mutation.isPending}>
            {mutation.isPending ? (
              <Loader2Icon className="h-4 w-4 animate-spin" />
            ) : (
              <SendIcon className="h-4 w-4" />
            )}
            <span className="sr-only">Send</span>
          </Button>
        </form>
      )}
    </div>
  );
};
