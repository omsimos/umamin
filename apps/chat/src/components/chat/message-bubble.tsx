import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@umamin/ui/components/popover";
import { cn } from "@umamin/ui/lib/utils";
import { useState } from "react";
import { groupReactions } from "../../lib/reactions";
import type { ChatMessage } from "../../lib/session/types";
import { ReactionDetails, type Reactor } from "./reaction-details";
import { ReactionPicker } from "./reaction-picker";

export function MessageBubble({
  message,
  onReact,
  self,
  partner,
}: {
  message: ChatMessage;
  onReact: (emoji: string) => void;
  self: Reactor;
  partner: Reactor;
}) {
  const [open, setOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const mine = message.author === "self";
  const selfReaction = message.reactions.find((r) => r.by === "self")?.emoji;
  const groups = groupReactions(message.reactions);

  return (
    <div className={cn("flex w-full", mine ? "justify-end" : "justify-start")}>
      <div className="relative max-w-[78%]">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`${mine ? "You" : "They"} said: ${message.text}. Tap to react.`}
              className={cn(
                "rounded-2xl px-3.5 py-2 text-left text-sm leading-relaxed break-words",
                "focus-visible:border-ring focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
                "transition-[filter] active:brightness-95",
                mine
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-muted text-foreground rounded-bl-sm",
              )}
            >
              {message.text}
            </button>
          </PopoverTrigger>
          {/* Portaled + viewport collision-aware, so the picker flips below the
              bubble near the top instead of being clipped under the header. */}
          <PopoverContent
            side="top"
            align={mine ? "end" : "start"}
            sideOffset={8}
            // Clear the stacked top chrome (app header + chat header) so a
            // near-top message flips the picker below instead of over them.
            collisionPadding={{ top: 116, bottom: 16, left: 12, right: 12 }}
            className="bg-popover/95 w-auto rounded-full border p-1 shadow-lg backdrop-blur"
          >
            <ReactionPicker
              current={selfReaction}
              onPick={(emoji) => {
                onReact(emoji);
                setOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
        {groups.length > 0 && (
          <>
            <button
              type="button"
              aria-label="View reactions"
              onClick={() => setDetailsOpen(true)}
              className={cn(
                "bg-popover absolute -bottom-3 flex items-center gap-1 rounded-full border px-2 py-0.5 text-base leading-none shadow-sm",
                "focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
                "transition-transform active:scale-95",
                mine ? "left-2" : "right-2",
              )}
            >
              {groups.map((group) => (
                <span key={group.emoji} className="flex items-center gap-0.5">
                  {group.emoji}
                  {group.count > 1 && (
                    <span className="text-muted-foreground text-xs font-medium tabular-nums">
                      {group.count}
                    </span>
                  )}
                </span>
              ))}
            </button>
            <ReactionDetails
              open={detailsOpen}
              onOpenChange={setDetailsOpen}
              reactions={message.reactions}
              self={self}
              partner={partner}
            />
          </>
        )}
      </div>
    </div>
  );
}
