import { Button } from "@umamin/ui/components/button";
import {
  ChatComposer,
  ChatComposerInput,
  ChatComposerSend,
} from "@umamin/ui/components/chat";
import { cn } from "@umamin/ui/lib/utils";
import { FlameIcon, ReplyIcon, XIcon } from "lucide-react";
import {
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useDynamicTextarea } from "@/hooks/use-dynamic-textarea";
import { MAX_MESSAGE_LEN } from "@/lib/chat/constants";
import type { PlayChoice } from "@/lib/chat/decks";
import {
  ComposerActions,
  type ComposerMode,
  IDLE_MODE,
} from "./composer-actions";

const TYPING_IDLE_MS = 2500;

export interface ComposerReplyTo {
  /** Viewer-relative name of the quoted author ("yourself" or the partner's alias). */
  authorLabel: string;
  text: string;
}

const EFFECT_LABELS: Record<string, string> = {
  confetti: "🎉 Sends with confetti",
  hearts: "💖 Sends with hearts",
  sparkles: "✨ Sends with sparkles",
  poof: "💨 Sends with a poof",
  golden: "👑 Sends with golden hearts",
};

function modeLabel(mode: ComposerMode): string {
  if (mode.whisper) return "Whisper: disappears about 10s after it's read";
  if (mode.effect) return EFFECT_LABELS[mode.effect] ?? "";
  return "";
}

/** A dismissible strip above the input: the reply target or the send mode. */
function ComposerChip({
  icon,
  children,
  clearLabel,
  onClear,
}: {
  icon?: ReactNode;
  children: ReactNode;
  clearLabel: string;
  onClear?: () => void;
}) {
  return (
    <div className="bg-muted/50 animate-chat-pop-in mb-2 flex items-center gap-2 rounded-xl py-1.5 pr-1 pl-3 motion-reduce:animate-none">
      {icon}
      <div className="min-w-0 flex-1 text-xs">{children}</div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={clearLabel}
        onClick={onClear}
        className="size-7 shrink-0 rounded-full"
      >
        <XIcon />
      </Button>
    </div>
  );
}

export function MessageComposer({
  onSend,
  onTyping,
  onPlay,
  replyTo,
  onCancelReply,
}: {
  onSend: (text: string, mode: ComposerMode) => void;
  onTyping?: (isTyping: boolean) => void;
  /** Start a game from the actions sheet. Absent = games hidden. */
  onPlay?: (choice: PlayChoice) => void;
  replyTo?: ComposerReplyTo | null;
  onCancelReply?: () => void;
}) {
  const [value, setValue] = useState("");
  const [mode, setMode] = useState<ComposerMode>(IDLE_MODE);
  const typingRef = useRef(false);
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
    if (idleTimer.current) {
      clearTimeout(idleTimer.current);
      idleTimer.current = null;
    }
    if (typingRef.current) {
      typingRef.current = false;
      onTyping?.(false);
    }
  }, [onTyping]);

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
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

  function send() {
    if (!canSend) return;
    onSend(value.trim(), mode);
    setValue("");
    setMode(IDLE_MODE);
    stopTyping();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape" && replyTo) {
      e.preventDefault();
      onCancelReply?.();
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

  // Starting a reply is an intent to type, so pull focus to the input.
  useEffect(() => {
    if (replyTo) textareaRef.current?.focus();
  }, [replyTo]);

  return (
    <div className="bg-background shrink-0 border-t px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {replyTo && (
        <ComposerChip
          icon={
            <ReplyIcon
              aria-hidden
              className="text-muted-foreground size-4 shrink-0"
            />
          }
          clearLabel="Cancel reply"
          onClear={onCancelReply}
        >
          <p className="font-medium">Replying to {replyTo.authorLabel}</p>
          <p className="text-muted-foreground truncate">{replyTo.text}</p>
        </ComposerChip>
      )}
      {(mode.whisper || mode.effect) && (
        <ComposerChip
          icon={
            mode.whisper ? (
              <FlameIcon
                aria-hidden
                className="size-4 shrink-0 text-orange-500"
              />
            ) : undefined
          }
          clearLabel="Clear message option"
          onClear={() => setMode(IDLE_MODE)}
        >
          <p className="truncate font-medium">{modeLabel(mode)}</p>
        </ComposerChip>
      )}
      <ChatComposer onSubmit={submit}>
        <ComposerActions mode={mode} onModeChange={setMode} onPlay={onPlay} />
        <ChatComposerInput
          ref={inputRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={stopTyping}
          placeholder={mode.whisper ? "Whisper something…" : "Type a message…"}
          aria-label="Message"
          autoComplete="off"
          maxLength={MAX_MESSAGE_LEN}
          className={cn(mode.whisper && "border-orange-400/60 border-dashed")}
        />
        {/* Never disabled by a pending send: the append is optimistic, and
            a disabled button would drop focus and close the mobile keyboard. */}
        <ChatComposerSend disabled={!canSend} aria-label="Send" />
      </ChatComposer>
    </div>
  );
}
