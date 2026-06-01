"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@umamin/ui/components/avatar";
import { Button } from "@umamin/ui/components/button";
import { Textarea } from "@umamin/ui/components/textarea";
import { cn } from "@umamin/ui/lib/utils";
import { Loader2Icon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEventHandler, useState } from "react";
import { useCreatePost } from "@/hooks/use-create-post";
import { useDynamicTextarea } from "@/hooks/use-dynamic-textarea";
import { isOlderThanOneYear } from "@/lib/utils";
import type { PublicUser } from "@/types/user";

export function ComposeView({ user }: { user: PublicUser | null }) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const inputRef = useDynamicTextarea(content);
  const { submitPost, isPending } = useCreatePost(user);

  const count = content.length;
  const overLimit = count > 500;
  const canPost = !isPending && content.trim().length > 0 && !overLimit;

  const close = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/feed");
    }
  };

  const handleSubmit: FormEventHandler = (e) => {
    e.preventDefault();
    if (!canPost) return;
    submitPost(content);
    router.push("/feed");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex min-h-dvh w-full max-w-xl flex-col"
    >
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-4 py-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={close}
          aria-label="Cancel"
        >
          <XIcon />
        </Button>

        <div className="flex items-center gap-3">
          <span
            className={cn(
              "text-sm",
              overLimit ? "text-red-500" : "text-zinc-500",
            )}
          >
            {count >= 450 ? 500 - count : null}
          </span>
          <Button
            type="submit"
            disabled={!canPost}
            className="rounded-full px-5"
          >
            {isPending ? <Loader2Icon className="animate-spin" /> : "Post"}
          </Button>
        </div>
      </header>

      <div className="flex flex-1 gap-3 px-4 py-4">
        <Avatar
          className={cn("mt-1", {
            "avatar-shine": isOlderThanOneYear(user?.createdAt),
          })}
        >
          <AvatarImage src={user?.imageUrl ?? ""} alt="User avatar" />
          <AvatarFallback>
            {user?.username ? user.username.slice(0, 2).toUpperCase() : "UM"}
          </AvatarFallback>
        </Avatar>

        <Textarea
          id="compose"
          autoFocus
          required
          ref={inputRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="How's your day going?"
          className="flex-1 border-0 px-0 text-base shadow-none caret-pink-300 focus-visible:ring-transparent dark:bg-transparent"
          autoComplete="off"
        />
      </div>
    </form>
  );
}
