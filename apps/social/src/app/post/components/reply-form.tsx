"use client";

import { useDynamicTextarea } from "@/hooks/use-dynamic-textarea";
import { Button } from "@umamin/ui/components/button";
import { Textarea } from "@umamin/ui/components/textarea";
import { Loader2, Send } from "lucide-react";
import { useState } from "react";

export default function ReplyForm() {
  const [content, setContent] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const inputRef = useDynamicTextarea(content);

  return (
    <div className="fixed px-5 sm:px-7 bottom-0 left-1/2 -translate-x-1/2 w-full pb-4 rounded-b-lg bg-background pt-3 max-w-xl">
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
          className="focus-visible:ring-transparent text-base resize-none min-h-10 max-h-20 bg-muted"
          autoComplete="off"
        />
        <Button
          data-testid="note-send-reply-btn"
          type="submit"
          size="icon"
          disabled={isSending}
        >
          {isSending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          <span className="sr-only">Send</span>
        </Button>
      </form>
    </div>
  );
}
