"use client";

import { Badge } from "@umamin/ui/components/badge";
import { Button } from "@umamin/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@umamin/ui/components/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@umamin/ui/components/drawer";
import { ArrowRightIcon, MessageSquareQuoteIcon } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { umaminChatUrl } from "@/lib/chat-link";

const CHAT_URL = umaminChatUrl("nav");

const SEEN_KEY = "umamin:chat-promo-seen";

const DESCRIPTION =
  "Get matched with a stranger who shares your interests for an anonymous, one-on-one chat. No sign-up, no history — nothing is saved.";

export function ChatPromo() {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  // Hidden until mounted so an already-opened promo never flashes the dot.
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(SEEN_KEY)) setShowNew(true);
    } catch {
      setShowNew(true);
    }
  }, []);

  const handleOpenChange = (open: boolean) => {
    if (!open) return;
    setShowNew(false);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // Storage unavailable — the dot returns next visit.
    }
  };

  // Plain <button>: this is one item in the menu-bar, whose layout/hover/sizing
  // come from the parent's `*:` child selectors (its siblings are <Link>s). A
  // <Button> fights those rules and breaks the bar.
  const trigger = (
    <button type="button" aria-label="About Umamin Chat" title="Umamin Chat">
      <span className="relative">
        <MessageSquareQuoteIcon className="h-6 w-6" />
        {showNew && (
          <span
            aria-hidden="true"
            data-testid="chat-promo-new-dot"
            className="absolute -right-1 -top-1 flex size-2"
          >
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pink-500 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-pink-500" />
          </span>
        )}
      </span>
    </button>
  );

  const title = (
    <>
      <Image
        src="/umamin-chat-logo.png"
        alt=""
        width={24}
        height={24}
        className="size-6 rounded-md"
      />
      Umamin Chat
      <Badge variant="secondary" className="font-normal">
        Beta
      </Badge>
    </>
  );

  const cta = (
    <Button asChild size="lg" className="w-full rounded-full">
      <a href={CHAT_URL} target="_blank" rel="noopener noreferrer">
        Start chatting
        <ArrowRightIcon />
      </a>
    </Button>
  );

  if (isDesktop) {
    return (
      <Dialog onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {title}
            </DialogTitle>
            <DialogDescription className="text-left leading-relaxed">
              {DESCRIPTION}
            </DialogDescription>
          </DialogHeader>
          {cta}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer onOpenChange={handleOpenChange}>
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent className="p-4">
        <DrawerHeader className="px-0 text-left group-data-[vaul-drawer-direction=bottom]/drawer-content:text-left">
          <DrawerTitle className="flex items-center gap-2">{title}</DrawerTitle>
          <DrawerDescription className="leading-relaxed">
            {DESCRIPTION}
          </DrawerDescription>
        </DrawerHeader>
        {cta}
      </DrawerContent>
    </Drawer>
  );
}
