"use client";

import { Button } from "@umamin/ui/components/button";
import { cn } from "@umamin/ui/lib/utils";
import { ArrowRightIcon, XIcon } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { umaminChatUrl } from "@/lib/chat-link";

const DISMISSED_KEY = "umamin:chat-announcement-dismissed";

export function ChatAnnouncement({ className }: { className?: string }) {
  // Hidden until mounted so a prior dismissal never flashes the banner.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(DISMISSED_KEY)) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Storage unavailable — the dismissal lasts for this visit only.
    }
  };

  return (
    <aside
      aria-label="Umamin Chat announcement"
      className={cn(
        "flex flex-wrap items-start gap-3 rounded-lg border bg-card p-3 sm:flex-nowrap sm:items-center sm:p-4",
        className,
      )}
    >
      <Image
        src="/umamin-chat-logo.png"
        alt=""
        width={36}
        height={36}
        className="mt-0.5 size-8 shrink-0 rounded-md sm:mt-0 sm:size-9"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">Umamin Chat is here</p>
        <p className="text-sm text-muted-foreground sm:truncate">
          Anonymous chats, matched by your interests.
        </p>
      </div>
      <Button
        asChild
        size="sm"
        className="order-last w-full shrink-0 rounded-full sm:order-none sm:w-auto"
      >
        <a
          href={umaminChatUrl("announcement")}
          target="_blank"
          rel="noopener noreferrer"
        >
          Try it
          <ArrowRightIcon />
        </a>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 shrink-0 text-muted-foreground"
        aria-label="Dismiss announcement"
        onClick={dismiss}
      >
        <XIcon />
      </Button>
    </aside>
  );
}
