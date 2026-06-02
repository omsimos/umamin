import { Button } from "@umamin/ui/components/button";
import { Input } from "@umamin/ui/components/input";
import { Send } from "lucide-react";
import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

const TYPING_IDLE_MS = 2500;

export function MessageComposer({
  onSend,
  onTyping,
}: {
  onSend: (text: string) => void;
  /** Best-effort typing signal; debounced (true on first keystroke, false on idle/send). */
  onTyping?: (isTyping: boolean) => void;
}) {
  const [value, setValue] = useState("");
  const typingRef = useRef(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canSend = value.trim().length > 0;

  const stopTyping = useCallback(() => {
    if (idleTimer.current) {
      clearTimeout(idleTimer.current);
      idleTimer.current = null;
    }
    if (typingRef.current) {
      typingRef.current = false;
      onTyping?.(false);
    }
  }, [onTyping]);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    setValue(e.target.value);
    if (!onTyping) return;
    if (e.target.value.trim().length === 0) {
      stopTyping();
      return;
    }
    if (!typingRef.current) {
      typingRef.current = true;
      onTyping(true);
    }
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(stopTyping, TYPING_IDLE_MS);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    onSend(value.trim());
    setValue("");
    stopTyping();
  }

  // Clear the typing flag (and timer) when the composer unmounts.
  useEffect(() => stopTyping, [stopTyping]);

  return (
    <form onSubmit={submit} className="flex items-center gap-2 border-t p-3">
      <Input
        value={value}
        onChange={handleChange}
        placeholder="Type a message…"
        aria-label="Message"
        maxLength={2000}
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
