import { cn } from "@umamin/ui/lib/utils";
import { useState } from "react";
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
  const mine = message.author === "self";

  return (
    <div className={cn("flex w-full", mine ? "justify-end" : "justify-start")}>
      <div className="relative max-w-[78%]">
        {picking && (
          <ReactionPicker
            onPick={(emoji) => {
              onReact(emoji);
              setPicking(false);
            }}
          />
        )}
        <button
          type="button"
          onClick={() => setPicking((p) => !p)}
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
          <div
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
