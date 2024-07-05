import { toast } from "sonner";
import { useState } from "react";
import { Send } from "lucide-react";
import { cn } from "@umamin/ui/lib/utils";
import { analytics } from "@/lib/firebase";
import { NoteQueryResult } from "../queries";
import { logEvent } from "firebase/analytics";

import { Input } from "@umamin/ui/components/input";
import { Button } from "@umamin/ui/components/button";
import { ChatList } from "@/app/components/chat-list";
import { Drawer, DrawerContent } from "@umamin/ui/components/drawer";
import { useMediaQuery } from "@/app/components/utilities/use-media-query";
import { Dialog, DialogContent } from "@umamin/ui/components/dialog";

type User = {
  note: Partial<Omit<NoteQueryResult, "user">>;
  user?: {
    displayName?: string | null;
    username?: string;
    imageUrl?: string | null;
    quietMode?: string | null;
  };
};

type ReplyDrawerProps = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
} & User;

export function ReplyDrawer({ open, setOpen, user, note }: ReplyDrawerProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0">
          <ChatForm user={user} note={note} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerContent className="grid place-items-center">
        <ChatForm user={user} note={note} />
      </DrawerContent>
    </Drawer>
  );
}

const ChatForm = ({ user, note }: User) => {
  const [content, setContent] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    try {
      setMessage(content);
      setContent("");
      toast.success("Message sent");

      logEvent(analytics, "send_message");
    } catch (err: any) {
      toast.error(err.message);
    }
  }
  return (
    <div
      className={cn(
        "max-w-xl w-full flex flex-col justify-between px-5 sm:px-7 pt-10 h-full max-h-[500px] overflow-scroll pb-24",
        user?.quietMode ? "min-h-[250px]" : "min-h-[350px]"
      )}
    >
      <ChatList
        imageUrl={user?.imageUrl}
        question={note.content ?? ""}
        reply={message}
      />
      <div className="fixed px-5 sm:px-7 bottom-0 left-1/2 -translate-x-1/2 w-full pb-4 backdrop-blur-sm pt-3 bg-background max-w-xl">
        <form
          onSubmit={handleSubmit}
          className="flex items-center space-x-2 w-full self-center"
        >
          <Input
            id="message"
            required
            // disabled={isFetching}
            maxLength={500}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Type your message..."
            className="focus-visible:ring-transparent flex-1 text-base"
            autoComplete="off"
          />
          <Button
            type="submit"
            size="icon"
            // disabled={isFetching}
            // disabled={input.trim().length === 0}
          >
            {/* {isFetching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : ( */}
            <Send className="h-4 w-4" />
            {/* )} */}
            <span className="sr-only">Send</span>
          </Button>
        </form>
      </div>
    </div>
  );
};
