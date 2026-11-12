"use client";

import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "@umamin/ui/lib/utils";
import type * as React from "react";

function Avatar({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      className={cn(
        "relative flex size-8 shrink-0 overflow-hidden rounded-full",
        className,
      )}
      {...props}
      data-slot="avatar"
    />
  );
}

function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      loading="lazy"
      decoding="async"
      // Don't leak the umamin URL to the avatar host (Google / Gravatar).
      referrerPolicy="no-referrer"
      className={cn("aspect-square size-full", className)}
      {...props}
      data-slot="avatar-image"
    />
  );
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      className={cn(
        "bg-muted flex size-full items-center justify-center rounded-full",
        className,
      )}
      {...props}
      data-slot="avatar-fallback"
    />
  );
}

export { Avatar, AvatarFallback, AvatarImage };
