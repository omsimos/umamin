import { cn } from "@umamin/ui/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../../lib/session/types";
import { ReactionPicker } from "./reaction-picker";

export function MessageBubble({
  message,
  onReact,
}: {
  message: ChatMessage;
  onReact: (emoji: string) => void;
}) {
  const [picking, setPicking] = useState(false);
  const [placement, setPlacement] = useState<"top" | "bottom">("top");
  const bubbleRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const mine = message.author === "self";

  const close = useCallback(() => {
    setPicking(false);
    bubbleRef.current?.focus();
  }, []);

  function toggle() {
    if (!picking) {
      // Open below when the bubble sits near the top (the chat header occupies
      // the first ~64px), otherwise the picker would be clipped behind it.
      const rect = bubbleRef.current?.getBoundingClientRect();
      setPlacement(rect && rect.top < 96 ? "bottom" : "top");
    }
    setPicking((p) => !p);
  }

  useEffect(() => {
    if (!picking) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      // The bubble's own click handler toggles; treat it as inside so an
      // outside-close + reopen race can't happen.
      if (
        !pickerRef.current?.contains(target) &&
        !bubbleRef.current?.contains(target)
      ) {
        setPicking(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [picking, close]);

  return (
    <div className={cn("flex w-full", mine ? "justify-end" : "justify-start")}>
      <div className="relative max-w-[78%]">
        {picking && (
          <div ref={pickerRef}>
            <ReactionPicker
              placement={placement}
              autoFocusFirst
              onPick={(emoji) => {
                onReact(emoji);
                close();
              }}
            />
          </div>
        )}
        <button
          ref={bubbleRef}
          type="button"
          aria-label={`${mine ? "You" : "They"} said: ${message.text}. Tap to react.`}
          onClick={toggle}
          className={cn(
            "rounded-2xl px-3.5 py-2 text-left text-sm leading-relaxed break-words",
            "focus-visible:border-ring focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
            mine
              ? "bg-primary text-primary-foreground rounded-br-sm"
              : "bg-muted text-foreground rounded-bl-sm",
          )}
        >
          {message.text}
        </button>
        {message.reactions.length > 0 && (
          // biome-ignore lint/a11y/useSemanticElements: a label-only grouping of reaction badges, not a form fieldset
          <div
            role="group"
            aria-label="Reactions"
            className={cn(
              "bg-popover absolute -bottom-2 flex gap-0.5 rounded-full border px-1.5 py-0.5 text-xs shadow-sm",
              mine ? "left-2" : "right-2",
            )}
          >
            {message.reactions.join(" ")}
          </div>
        )}
      </div>
    </div>
  );
}
