"use client";

import { HeartIcon, MessageCircleIcon, Repeat2Icon } from "lucide-react";
import { useState } from "react";

export function DemoSocial() {
  const [liked, setLiked] = useState(false);
  const [reposted, setReposted] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-44 flex-1 flex-col justify-center">
        <div className="rounded-xl border bg-background/60 p-4">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-full bg-sky-400/15 text-sm">
              🐈‍⬛
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold">someone</p>
              <p className="text-xs text-muted-foreground">@anon · 2m</p>
            </div>
          </div>

          <p className="pt-3 text-sm leading-relaxed">
            hot take: the best conversations happen with people who have no idea
            who you are.
          </p>

          <div className="flex items-center gap-5 pt-3">
            <button
              type="button"
              aria-pressed={liked}
              aria-label="Like"
              onClick={() => setLiked((v) => !v)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
            >
              <HeartIcon
                className={`size-4 ${liked ? "animate-heart-pop fill-primary text-primary" : ""}`}
              />
              <span className={liked ? "text-primary" : ""}>
                {liked ? 129 : 128}
              </span>
            </button>

            <button
              type="button"
              aria-pressed={reposted}
              aria-label="Repost"
              onClick={() => setReposted((v) => !v)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-sky-400"
            >
              <Repeat2Icon
                className={`size-4 transition-transform duration-300 ${
                  reposted ? "rotate-180 text-sky-400" : ""
                }`}
              />
              <span className={reposted ? "text-sky-400" : ""}>
                {reposted ? 42 : 41}
              </span>
            </button>

            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MessageCircleIcon className="size-4" />
              36
            </span>
          </div>
        </div>
      </div>

      <p className="pt-3 text-sm text-muted-foreground">
        A whole feed of takes nobody has to own. Hot, sorted.
      </p>
    </div>
  );
}
