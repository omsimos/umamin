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

export function ReplyDrawer({
  openDrawer,
  setOpenDrawer,
  user,
  note,
}: {
  openDrawer: boolean;
  setOpenDrawer: React.Dispatch<React.SetStateAction<boolean>>;
  note: Partial<Omit<NoteQueryResult, "user">>;
  user?: {
    displayName?: string | null;
    username?: string;
    imageUrl?: string | null;
    quietMode?: string | null;
  };
}) {
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
    <Drawer open={openDrawer} onOpenChange={setOpenDrawer}>
      <DrawerContent className="grid place-items-center">
        <div
          className={cn(
            "container max-w-xl w-full flex flex-col justify-between px-5 sm:px-7 pt-10 pb-8 h-full",
            user?.quietMode ? "min-h-[250px]" : "min-h-[350px]"
          )}
        >
          <ChatList
            imageUrl={user?.imageUrl}
            question={note.content ?? ""}
            reply={message}
          />

          {user?.quietMode ? (
            <span className="text-muted-foreground text-center text-sm">
              User has enabled quiet mode
            </span>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="flex items-center space-x-2 w-full self-center mt-12"
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
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
