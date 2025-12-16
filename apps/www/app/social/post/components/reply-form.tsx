"use client";

import type { SelectUser } from "@umamin/db/schema/user";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@umamin/ui/components/avatar";
import { Button } from "@umamin/ui/components/button";
import { Textarea } from "@umamin/ui/components/textarea";
import { Loader2Icon, ScanFaceIcon, SendIcon } from "lucide-react";
import { useState } from "react";
import { useDynamicTextarea } from "@/hooks/use-dynamic-textarea";

export default function ReplyForm({ user }: { user: SelectUser | null }) {
  const [content, setContent] = useState("");
  // const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const inputRef = useDynamicTextarea(content);

  if (!user) return;

  return (
    <div className="flex gap-3 w-full bg-background">
      <Avatar>
        <AvatarImage src={user.imageUrl ?? ""} alt="User avatar" />
        <AvatarFallback>
          <ScanFaceIcon />
        </AvatarFallback>
      </Avatar>
      <form
        //   onSubmit={handleSubmit}
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
          placeholder="Leave a reply..."
          className="focus-visible:ring-transparent text-sm resize-none min-h-10 max-h-20 bg-muted/50 caret-pink-300"
          autoComplete="off"
        />
        <Button
          data-testid="note-send-reply-btn"
          type="submit"
          size="icon"
          disabled={isSending}
        >
          {isSending ? (
            <Loader2Icon className="w-4 h-4 animate-spin" />
          ) : (
            <SendIcon className="h-4 w-4" />
          )}
          <span className="sr-only">SendIcon</span>
        </Button>
      </form>
    </div>
  );
}
