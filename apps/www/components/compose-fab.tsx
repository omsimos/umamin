"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@umamin/ui/components/avatar";
import { Button } from "@umamin/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@umamin/ui/components/dialog";
import { Textarea } from "@umamin/ui/components/textarea";
import { cn } from "@umamin/ui/lib/utils";
import { Loader2Icon, PlusIcon, XIcon } from "lucide-react";
import { type FormEventHandler, useState } from "react";
import { useCreatePost } from "@/hooks/use-create-post";
import { useDynamicTextarea } from "@/hooks/use-dynamic-textarea";
import { isOlderThanOneYear } from "@/lib/utils";
import type { PublicUser } from "@/types/user";

// Composing happens inline on the feed (dialog), not a separate /compose route:
// the post action stays bound to /feed and we never cross-route navigate, which
// is what caused the production self-call timeout.
export function ComposeFab({ user }: { user: PublicUser | null }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const inputRef = useDynamicTextarea(content);
  const { submitPost, isPending } = useCreatePost(user);

  const count = content.length;
  const overLimit = count > 500;
  const canPost = !isPending && content.trim().length > 0 && !overLimit;

  const handleSubmit: FormEventHandler = async (e) => {
    e.preventDefault();
    if (!canPost) return;
    try {
      await submitPost(content);
      setContent("");
      setOpen(false);
    } catch {
      // onError already toasted + rolled back; keep the dialog open to retry.
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Create post"
        className="fixed bottom-24 right-4 z-40 flex size-14 items-center justify-center rounded-full bg-pink-500 text-white shadow-lg transition-colors hover:bg-pink-600 lg:bottom-8"
      >
        <PlusIcon className="size-6" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="flex h-dvh max-w-xl flex-col gap-0 p-0 sm:h-auto sm:max-h-[80dvh] sm:rounded-xl"
        >
          <DialogTitle className="sr-only">Create post</DialogTitle>
          <DialogDescription className="sr-only">
            Write a new post
          </DialogDescription>

          <form onSubmit={handleSubmit} className="flex flex-1 flex-col">
            <header className="flex items-center justify-between border-b px-4 py-3">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
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
                  {isPending ? (
                    <Loader2Icon className="animate-spin" />
                  ) : (
                    "Post"
                  )}
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
                  {user?.username
                    ? user.username.slice(0, 2).toUpperCase()
                    : "UM"}
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
                className="flex-1 resize-none border-0 px-0 text-base shadow-none caret-pink-300 focus-visible:ring-transparent dark:bg-transparent"
                autoComplete="off"
              />
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
