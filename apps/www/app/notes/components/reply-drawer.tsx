import { toast } from "sonner";
import { useState } from "react";
import { Loader2Icon, SendIcon } from "lucide-react";

import { useMediaQuery } from "@/hooks/use-media-query";
import { useDynamicTextarea } from "@/hooks/use-dynamic-textarea";
import { SelectNote } from "@umamin/db/schema/note";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@umamin/ui/components/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@umamin/ui/components/drawer";
import { formatContent } from "@/lib/utils";
import { cn } from "@umamin/ui/lib/utils";
import { ChatList } from "@/components/chat-list";
import { Textarea } from "@umamin/ui/components/textarea";
import { Button } from "@umamin/ui/components/button";
import { SelectUser } from "@umamin/db/schema/user";
import { PublicUser } from "@/types/user";
import { useMutation } from "@tanstack/react-query";
import { sendMessageAction } from "@/app/actions/message";

type ChatFormProps = {
  note: SelectNote & { user: PublicUser };
};

type ReplyDrawerProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
} & ChatFormProps;

export function ReplyDrawer({ isOpen, setIsOpen, note }: ReplyDrawerProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="p-0">
          <DialogTitle className="sr-only"></DialogTitle>
          <ChatForm note={note} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <DrawerContent className="grid place-items-center">
        <DrawerTitle className="sr-only"></DrawerTitle>
        <ChatForm note={note} />
      </DrawerContent>
    </Drawer>
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
        "max-w-xl w-full flex flex-col justify-between px-5 sm:px-7 py-10 h-full max-h-[500px] overflow-scroll rounded-lg",
        user?.quietMode ? "min-h-[250px]" : "min-h-[350px]",
        !message ? "pb-28" : "",
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
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
              }}
              maxLength={500}
              placeholder="Type your anonymous reply..."
              className="focus-visible:ring-transparent text-base resize-none min-h-10 max-h-20"
              autoComplete="off"
            />
            <Button type="submit" size="icon" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <Loader2Icon className="w-4 h-4 animate-spin" />
              ) : (
                <SendIcon className="h-4 w-4" />
              )}
              <span className="sr-only">SendIcon</span>
            </Button>
          </form>
        </div>
      )}
    </div>
  );
};
