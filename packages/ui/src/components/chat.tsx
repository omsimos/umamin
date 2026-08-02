"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@umamin/ui/components/avatar";
import { Button } from "@umamin/ui/components/button";
import { cn } from "@umamin/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2Icon, ScanFaceIcon, SendIcon } from "lucide-react";
import type * as React from "react";

// Shared conversation primitives. "incoming" is the other party (left, muted),
// "outgoing" is the viewer (right, primary) — the sides are a display concern,
// so callers map their own authorship model onto them.

const bubbleVariants = cva(
  "rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words min-w-0",
  {
    variants: {
      side: {
        incoming: "bg-muted",
        outgoing: "bg-primary text-primary-foreground",
      },
      state: {
        idle: "",
        pending: "opacity-60",
        failed: "ring-1 ring-destructive/60",
      },
    },
    defaultVariants: { side: "incoming", state: "idle" },
  },
);

function ChatBubble({
  className,
  side,
  state,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof bubbleVariants>) {
  return (
    <div
      data-slot="chat-bubble"
      className={cn(bubbleVariants({ side, state }), className)}
      {...props}
    />
  );
}

function ChatThread({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="chat-thread"
      // Rows carry their own top spacing, so the first one must not indent
      // the thread away from whatever sits above it.
      className={cn("flex flex-col [&>*:first-child]:mt-0", className)}
      {...props}
    />
  );
}

/**
 * One message row: optional avatar gutter plus a stacked column for the
 * bubble and its meta line. `tight` is the consecutive-message spacing —
 * same author in a run reads as one block instead of a ladder.
 */
function ChatRow({
  className,
  side = "incoming",
  avatar,
  tight,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  side?: "incoming" | "outgoing";
  // Pass `null` to keep the gutter width without rendering an avatar, so
  // bubbles in a run stay left-aligned with the first one.
  avatar?: React.ReactNode;
  tight?: boolean;
  children: React.ReactNode;
}) {
  const outgoing = side === "outgoing";

  return (
    <div
      data-slot="chat-row"
      className={cn(
        "flex items-end gap-2",
        outgoing ? "flex-row-reverse" : "flex-row",
        tight ? "mt-0.5" : "mt-3",
        className,
      )}
      {...props}
    >
      {avatar !== undefined &&
        (avatar ?? <div className="w-8 shrink-0" aria-hidden />)}
      <div
        className={cn(
          "flex max-w-[78%] flex-col gap-0.5",
          outgoing ? "items-end" : "items-start",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function ChatAvatar({
  className,
  src,
  ...props
}: React.ComponentProps<typeof Avatar> & { src?: string | null }) {
  return (
    <Avatar className={cn("size-8 shrink-0", className)} {...props}>
      <AvatarImage src={src ?? ""} alt="" />
      <AvatarFallback>
        <ScanFaceIcon className="size-4" />
      </AvatarFallback>
    </Avatar>
  );
}

function ChatMeta({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="chat-meta"
      className={cn(
        "flex min-w-0 items-center gap-1.5 text-muted-foreground text-xs",
        className,
      )}
      {...props}
    />
  );
}

function ChatDaySeparator({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="chat-day-separator"
      className={cn("my-4 flex items-center gap-3", className)}
      {...props}
    >
      <span className="h-px flex-1 bg-border" />
      <span className="shrink-0 text-muted-foreground text-xs">{children}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function ChatComposer({ className, ...props }: React.ComponentProps<"form">) {
  return (
    <form
      data-slot="chat-composer"
      className={cn("flex items-end gap-2", className)}
      {...props}
    />
  );
}

function ChatComposerInput({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="chat-composer-input"
      rows={1}
      className={cn(
        // min-h matches ChatComposerSend so the two stay aligned, and clears
        // the 3rem floor that useDynamicTextarea's auto-grow resets to.
        "max-h-32 min-h-12 flex-1 resize-none rounded-2xl border bg-muted/40 px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        className,
      )}
      {...props}
    />
  );
}

function ChatComposerSend({
  className,
  pending,
  disabled,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { pending?: boolean }) {
  return (
    <Button
      type="submit"
      size="icon"
      data-slot="chat-composer-send"
      className={cn("size-12 shrink-0 rounded-full", className)}
      {...props}
      disabled={pending || disabled}
    >
      {pending ? (
        <Loader2Icon className="size-4 animate-spin" />
      ) : (
        (children ?? <SendIcon className="size-4" />)
      )}
      <span className="sr-only">Send</span>
    </Button>
  );
}

export {
  bubbleVariants,
  ChatAvatar,
  ChatBubble,
  ChatComposer,
  ChatComposerInput,
  ChatComposerSend,
  ChatDaySeparator,
  ChatMeta,
  ChatRow,
  ChatThread,
};
