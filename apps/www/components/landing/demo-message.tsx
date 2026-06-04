"use client";

import { Button } from "@umamin/ui/components/button";
import { Input } from "@umamin/ui/components/input";
import { BadgeCheckIcon, LockIcon, SendIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AnimatedShinyText } from "@/components/animated-shiny-text";

const SUGGESTIONS = ["you seem cool", "spill a secret", "rate my vibe"];
const MAX_SENT = 3;

type Bubble = { id: number; text: string; revealed: boolean };

function toCipher(text: string) {
  try {
    return `${btoa(text).slice(0, 24)}=`;
  } catch {
    // btoa rejects non-latin1 input (emoji etc.)
    return "U2FsdGVkX19zZWNyZXQredact=";
  }
}

export function DemoMessage() {
  const [draft, setDraft] = useState("");
  const [sent, setSent] = useState<Bubble[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sent.length >= MAX_SENT) return;

    const id = Date.now();
    setSent((prev) => [...prev, { id, text: trimmed, revealed: false }]);
    setDraft("");
    timers.current.push(
      setTimeout(() => {
        setSent((prev) =>
          prev.map((b) => (b.id === id ? { ...b, revealed: true } : b)),
        );
      }, 1300),
    );
  };

  const full = sent.length >= MAX_SENT;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b border-dashed pb-3 text-sm">
        <span className="text-muted-foreground">To:</span>
        <span className="font-semibold">Umamin Official</span>
        <BadgeCheckIcon className="size-4 text-primary" />
      </div>

      <div className="flex min-h-44 flex-1 flex-col gap-3 py-4">
        <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm">
          Send me an anonymous message!
        </div>

        {sent.map((bubble) => (
          <div key={bubble.id} className="flex flex-col items-end gap-1">
            <div className="max-w-[80%] animate-rise rounded-2xl rounded-br-sm bg-primary/15 px-3 py-2 text-sm">
              {bubble.revealed ? (
                bubble.text
              ) : (
                <AnimatedShinyText className="mx-0 max-w-full text-left font-mono text-xs">
                  {toCipher(bubble.text)}
                </AnimatedShinyText>
              )}
            </div>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <LockIcon className="size-2.5" />
              {bubble.revealed ? "AES-256 · delivered" : "encrypting…"}
            </span>
          </div>
        ))}
      </div>

      <div className="mb-2 flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={full}
            onClick={() => send(s)}
            className="rounded-full border border-dashed px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground disabled:opacity-40"
          >
            {s}
          </button>
        ))}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        <Input
          value={draft}
          maxLength={120}
          disabled={full}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={full ? "now imagine it's your inbox" : "say anything…"}
          aria-label="Anonymous message"
        />
        <Button
          type="submit"
          size="icon"
          disabled={full || !draft.trim()}
          aria-label="Send anonymous message"
        >
          <SendIcon />
        </Button>
      </form>
    </div>
  );
}
