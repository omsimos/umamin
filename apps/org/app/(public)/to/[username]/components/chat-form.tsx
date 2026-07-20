"use client";

import { Button } from "@umamin/ui/components/button";
import { Textarea } from "@umamin/ui/components/textarea";
import { CheckCircle2Icon, Loader2Icon, SendIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { sendMessageAction } from "@/app/actions/message";

export function ChatForm({
  orgId,
  messageCharLimit,
}: {
  orgId: string;
  messageCharLimit: number;
}) {
  const [content, setContent] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = content.trim();
    if (!text) return;

    startTransition(async () => {
      const res = await sendMessageAction({ orgId, content: text });
      if (res && "error" in res) {
        toast.error(res.error);
        return;
      }
      setContent("");
      setSent(true);
    });
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <CheckCircle2Icon className="text-primary size-10" />
        <div>
          <p className="font-medium">Message sent anonymously</p>
          <p className="text-muted-foreground text-sm">
            Thanks for your message.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setSent(false)}
          className="h-11 w-full sm:h-9 sm:w-auto"
        >
          Send another
        </Button>
      </div>
    );
  }

  // No autoFocus: popping the keyboard on load hides the org's prompt on
  // phones — the reader should see it first.
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        maxLength={messageCharLimit}
        rows={5}
        placeholder="Type your anonymous message…"
        disabled={pending}
        className="bg-muted min-h-28 resize-none border-0"
      />
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
          {content.length}/{messageCharLimit}
        </span>
        {/* Thumb-sized on phones, compact on desktop. */}
        <Button
          type="submit"
          disabled={pending || !content.trim()}
          className="h-11 flex-1 sm:h-9"
        >
          {pending ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
          Send
        </Button>
      </div>
    </form>
  );
}
