import { Button } from "@umamin/ui/components/button";
import {
  ChatComposer,
  ChatComposerInput,
  ChatComposerSend,
} from "@umamin/ui/components/chat";
import { ReplyIcon, XIcon } from "lucide-react";
import {
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useDynamicTextarea } from "@/hooks/use-dynamic-textarea";
import { MAX_DM_LEN } from "@/lib/dm/constants";

const TYPING_IDLE_MS = 2500;
/** While typing continues, "on" is re-sent this often so it doesn't expire. */
const TYPING_REFRESH_MS = 5000;

export function DmComposer({
  onSend,
  onTyping,
  replyTo,
  onCancelReply,
}: {
  onSend: (text: string) => void;
  onTyping: (on: boolean) => void;
  replyTo: { authorLabel: string; text: string } | null;
  onCancelReply: () => void;
}) {
  const [value, setValue] = useState("");
  const typingSentAt = useRef(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const autosizeRef = useDynamicTextarea(value);
  const inputRef = useCallback(
    (el: HTMLTextAreaElement | null) => {
      textareaRef.current = el;
      autosizeRef(el);
    },
    [autosizeRef],
  );
  const canSend = value.trim().length > 0;

  const stopTyping = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = null;
    if (typingSentAt.current) {
      typingSentAt.current = 0;
      onTyping(false);
    }
  }, [onTyping]);

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
    if (e.target.value.trim().length === 0) {
      stopTyping();
      return;
    }
    const now = Date.now();
    if (now - typingSentAt.current > TYPING_REFRESH_MS) {
      typingSentAt.current = now;
      onTyping(true);
    }
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(stopTyping, TYPING_IDLE_MS);
  }

  function send() {
    if (!canSend) return;
    onSend(value.trim());
    setValue("");
    stopTyping();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape" && replyTo) {
      e.preventDefault();
      onCancelReply();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    send();
  }

  useEffect(() => stopTyping, [stopTyping]);

  useEffect(() => {
    if (replyTo) textareaRef.current?.focus();
  }, [replyTo]);

  return (
    <div className="bg-background shrink-0 border-t px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {replyTo && (
        <div className="bg-muted/50 animate-chat-pop-in mb-2 flex items-center gap-2 rounded-xl py-1.5 pr-1 pl-3 motion-reduce:animate-none">
          <ReplyIcon
            aria-hidden
            className="text-muted-foreground size-4 shrink-0"
          />
          <div className="min-w-0 flex-1 text-xs">
            <p className="font-medium">Replying to {replyTo.authorLabel}</p>
            <p className="text-muted-foreground truncate">{replyTo.text}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Cancel reply"
            onClick={onCancelReply}
            className="size-7 shrink-0 rounded-full"
          >
            <XIcon />
          </Button>
        </div>
      )}
      <ChatComposer onSubmit={submit}>
        <ChatComposerInput
          ref={inputRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={stopTyping}
          placeholder="Message…"
          aria-label="Message"
          autoComplete="off"
          maxLength={MAX_DM_LEN}
        />
        {/* Never disabled by a pending send: the append is optimistic, and a
            disabled button would drop focus and close the mobile keyboard. */}
        <ChatComposerSend disabled={!canSend} aria-label="Send" />
      </ChatComposer>
    </div>
  );
}
