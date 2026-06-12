import { Button } from "@umamin/ui/components/button";
import { Input } from "@umamin/ui/components/input";
import { cn } from "@umamin/ui/lib/utils";
import { Flame, Send, X } from "lucide-react";
import {
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { GameMode } from "../../lib/session/types";
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
  if (mode.whisper) return "Whisper — disappears ~10s after it's read";
  if (mode.effect) return EFFECT_LABELS[mode.effect] ?? "";
  return "";
}

export function MessageComposer({
  onSend,
  onTyping,
  onDealCard,
  replyTo,
  onCancelReply,
  vibeLevel,
  onShowVibe,
}: {
  onSend: (text: string, mode: ComposerMode) => void;
  onTyping?: (isTyping: boolean) => void;
  /** Deal a game card from the actions sheet. Absent = games hidden. */
  onDealCard?: (cardId: string, gameMode?: GameMode) => void;
  replyTo?: ComposerReplyTo | null;
  onCancelReply?: () => void;
  /** Gates locked play/effect tiles in the actions sheet. */
  vibeLevel?: number;
  onShowVibe?: () => void;
}) {
  const [value, setValue] = useState("");
  const [mode, setMode] = useState<ComposerMode>(IDLE_MODE);
  const typingRef = useRef(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const canSend = value.trim().length > 0;
  const modeActive = mode.whisper || mode.effect;

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

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape" && replyTo) {
      e.preventDefault();
      onCancelReply?.();
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    onSend(value.trim(), mode);
    setValue("");
    setMode(IDLE_MODE);
    stopTyping();
  }

  useEffect(() => stopTyping, [stopTyping]);

  // Starting a reply is an intent to type — pull focus to the input.
  useEffect(() => {
    if (replyTo) inputRef.current?.focus();
  }, [replyTo]);

  return (
    <div className="border-t">
      {replyTo && (
        <div className="bg-muted/40 flex items-center justify-between gap-3 border-b px-4 py-2">
          <div className="min-w-0">
            <p className="text-xs font-medium">
              Replying to {replyTo.authorLabel}
            </p>
            <p className="text-muted-foreground truncate text-xs">
              {replyTo.text}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Cancel reply"
            onClick={onCancelReply}
            className="shrink-0 rounded-full"
          >
            <X />
          </Button>
        </div>
      )}
      {modeActive && (
        <div className="bg-muted/40 flex items-center justify-between gap-3 border-b px-4 py-1.5">
          <p className="flex min-w-0 items-center gap-1.5 truncate text-xs font-medium">
            {mode.whisper && (
              <Flame
                aria-hidden
                className="size-3.5 shrink-0 text-orange-500"
              />
            )}
            {modeLabel(mode)}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Clear message option"
            onClick={() => setMode(IDLE_MODE)}
            className="size-7 shrink-0 rounded-full"
          >
            <X />
          </Button>
        </div>
      )}
      <form onSubmit={submit} className="flex items-center gap-2 p-3">
        <ComposerActions
          mode={mode}
          onModeChange={setMode}
          onDealCard={onDealCard}
          vibeLevel={vibeLevel}
          onShowVibe={onShowVibe}
        />
        <Input
          ref={inputRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={mode.whisper ? "Whisper something…" : "Type a message…"}
          aria-label="Message"
          maxLength={2000}
          className={cn(
            "rounded-full",
            mode.whisper && "ring-2 ring-orange-500/30",
          )}
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
    </div>
  );
}
