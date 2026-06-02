import { Button } from "@umamin/ui/components/button";
import { Input } from "@umamin/ui/components/input";
import { Send } from "lucide-react";
import { type FormEvent, useState } from "react";

export function MessageComposer({
  onSend,
}: {
  onSend: (text: string) => void;
}) {
  const [value, setValue] = useState("");
  const canSend = value.trim().length > 0;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    onSend(value.trim());
    setValue("");
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2 border-t p-3">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Type a message…"
        aria-label="Message"
        className="rounded-full"
      />
      <Button
        type="submit"
        size="icon"
        aria-label="Send"
        disabled={!canSend}
        className="rounded-full"
      >
        <Send />
      </Button>
    </form>
  );
}
