import {
  Bubble,
  BubbleContent,
  BubbleReactions,
} from "@umamin/ui/components/bubble";
import {
  Message,
  MessageContent,
  MessageFooter,
} from "@umamin/ui/components/message";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@umamin/ui/components/popover";
import { cn } from "@umamin/ui/lib/utils";
import { CopyIcon, FlagIcon, ReplyIcon, Undo2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { UiDmMessage } from "@/lib/dm/client-state";
import { ReactionPicker } from "../-umamin-chat/components/chat/reaction-picker";

const bubbleShape = "rounded-2xl px-3.5 py-2 leading-relaxed";

function MenuAction({
  icon,
  label,
  onClick,
  destructive = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "hover:bg-accent focus-visible:ring-ring/60 flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium outline-none focus-visible:ring-2",
        destructive && "text-destructive",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/** One DM row: a bubble with a tap menu for reacting, replying, copying and
 *  unsending (yours) or reporting (theirs). */
export function DmMessageBubble({
  message,
  peerName,
  highlighted,
  seen,
  canInteract,
  onReact,
  onReply,
  onUnsend,
  onReport,
  onJumpTo,
  onRetry,
}: {
  message: UiDmMessage;
  peerName: string;
  highlighted: boolean;
  /** The newest of my messages the peer has read. */
  seen: boolean;
  /** False when sending is closed; reacting needs the same access. */
  canInteract: boolean;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onUnsend: () => void;
  onReport: () => void;
  onJumpTo: (messageId: string) => void;
  onRetry: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { mine, delivery } = message;
  const reactions = [message.myReaction, message.theirReaction].filter(
    (r): r is string => r !== null,
  );
  const close = (fn: () => void) => () => {
    fn();
    setOpen(false);
  };

  if (message.text === null) {
    return (
      <Message align={mine ? "end" : "start"}>
        <MessageContent>
          <Bubble variant="muted">
            <BubbleContent
              className={cn(bubbleShape, "text-muted-foreground italic")}
            >
              {mine ? "You unsent a message" : `${peerName} unsent a message`}
            </BubbleContent>
          </Bubble>
        </MessageContent>
      </Message>
    );
  }

  const replyTo = message.replyTo;
  const quote = replyTo && (
    <button
      type="button"
      aria-label="Go to the replied-to message"
      onClick={() => onJumpTo(replyTo.id)}
      className={cn(
        "bg-muted/60 text-muted-foreground focus-visible:ring-ring/50 flex max-w-full min-w-0 flex-col rounded-xl border-l-2 px-2.5 py-1.5 text-left text-xs outline-none focus-visible:ring-[3px]",
        mine ? "border-primary/60 self-end" : "border-foreground/20",
      )}
    >
      <span className="text-foreground/80 flex items-center gap-1 font-medium">
        <ReplyIcon aria-hidden className="size-3" />
        {replyTo.mine ? "You" : peerName}
      </span>
      <span className="truncate">{replyTo.text ?? "Unsent message"}</span>
    </button>
  );

  return (
    <Message align={mine ? "end" : "start"}>
      <MessageContent className="gap-1">
        <Bubble
          variant={mine ? "default" : "muted"}
          className={cn(reactions.length > 0 && "mb-3.5")}
        >
          {quote}
          {delivery ? (
            <BubbleContent
              className={cn(
                bubbleShape,
                "whitespace-pre-wrap",
                delivery === "sending" ? "opacity-70" : "opacity-60",
              )}
            >
              {message.text}
              {delivery === "sending" && (
                <span className="sr-only"> (sending)</span>
              )}
            </BubbleContent>
          ) : (
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <BubbleContent asChild className={bubbleShape}>
                  <button
                    type="button"
                    aria-label={`${mine ? "You" : peerName} said: ${message.text}. Tap for options.`}
                    className={cn(
                      "text-left whitespace-pre-wrap transition-[filter,box-shadow] active:brightness-95",
                      highlighted && "ring-ring/60 ring-[3px]",
                    )}
                  >
                    {message.text}
                  </button>
                </BubbleContent>
              </PopoverTrigger>
              <PopoverContent
                aria-label="Message options"
                side="top"
                align={mine ? "end" : "start"}
                sideOffset={8}
                collisionPadding={{ top: 72, bottom: 16, left: 12, right: 12 }}
                className="bg-popover/95 w-auto rounded-3xl border p-1 shadow-lg backdrop-blur"
              >
                {canInteract && (
                  <div className="flex items-center gap-0.5">
                    <ReactionPicker
                      current={message.myReaction ?? undefined}
                      onPick={(emoji) => close(() => onReact(emoji))()}
                    />
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-center gap-0.5">
                  {canInteract && (
                    <MenuAction
                      icon={<ReplyIcon className="size-4" />}
                      label="Reply"
                      onClick={close(onReply)}
                    />
                  )}
                  <MenuAction
                    icon={<CopyIcon className="size-4" />}
                    label="Copy"
                    onClick={close(() => {
                      void navigator.clipboard
                        ?.writeText(message.text ?? "")
                        .then(() => toast.success("Copied"));
                    })}
                  />
                  {mine ? (
                    <MenuAction
                      icon={<Undo2Icon className="size-4" />}
                      label="Unsend"
                      destructive
                      onClick={close(onUnsend)}
                    />
                  ) : (
                    <MenuAction
                      icon={<FlagIcon className="size-4" />}
                      label="Report"
                      destructive
                      onClick={close(onReport)}
                    />
                  )}
                </div>
              </PopoverContent>
            </Popover>
          )}
          {reactions.length > 0 && (
            <BubbleReactions
              align={mine ? "start" : "end"}
              className="ring-background bg-muted"
            >
              <span
                key={reactions.join("|")}
                className="animate-chat-pop-in flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-sm leading-none motion-reduce:animate-none"
              >
                {reactions.length === 2 && reactions[0] === reactions[1] ? (
                  <>
                    {reactions[0]}
                    <span className="text-muted-foreground text-xs font-medium tabular-nums">
                      2
                    </span>
                  </>
                ) : (
                  reactions.join("")
                )}
              </span>
            </BubbleReactions>
          )}
        </Bubble>
        {delivery === "failed" ? (
          <MessageFooter className="px-1 font-normal">
            <button
              type="button"
              onClick={onRetry}
              className="focus-visible:ring-ring/50 text-destructive rounded-sm outline-none focus-visible:ring-[3px]"
            >
              Not delivered · Tap to retry
            </button>
          </MessageFooter>
        ) : (
          seen && (
            <MessageFooter className="px-1 font-normal">Seen</MessageFooter>
          )
        )}
      </MessageContent>
    </Message>
  );
}
